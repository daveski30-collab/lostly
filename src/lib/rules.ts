// The smart nudge engine. Pure functions with no phone stuff, so they are easy to test.
// Every rule is a reason NOT to bother you. If none of them apply, you get a nudge.

import type { CheckRecord, Item, NudgeDecision, NudgeRules, Place, VisitState, Weekday } from './types';

const MINUTE = 60_000;

export const MIN_RADIUS_METERS = 100;

export const DEFAULT_RULES: NudgeRules = {
  enabled: true,
  minDwellMinutes: 5,
  cooldownMinutes: 30,
  activeDays: [],
  activeHours: null,
  skipIfCheckedWithinMinutes: 10,
};

/** Is `hour` inside the window? Handles overnight windows like 22 -> 6. */
export function inHourWindow(hour: number, window: { start: number; end: number }): boolean {
  const { start, end } = window;
  if (start === end) return true; // a full day
  return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

/** Decide whether leaving `place` right now deserves a nudge. */
export function shouldNudgeOnExit(place: Place, state: VisitState, now: Date): NudgeDecision {
  const r = place.rules;
  const t = now.getTime();

  if (!r.enabled) return { nudge: false, reason: 'Nudges are turned off for this place' };

  if (r.activeDays.length > 0 && !r.activeDays.includes(now.getDay() as Weekday)) {
    return { nudge: false, reason: 'Not an active day for this place' };
  }

  if (r.activeHours && !inHourWindow(now.getHours(), r.activeHours)) {
    return { nudge: false, reason: 'Outside the active hours for this place' };
  }

  // If we never saw you arrive (e.g. the app was installed while you were here), give you the benefit of the doubt.
  const entered = state.enteredAt[place.id];
  if (entered !== undefined && t - entered < r.minDwellMinutes * MINUTE) {
    return { nudge: false, reason: `You were only here ${Math.round((t - entered) / MINUTE)} min (need ${r.minDwellMinutes})` };
  }

  const lastNudge = state.lastNudgedAt[place.id];
  if (lastNudge !== undefined && t - lastNudge < r.cooldownMinutes * MINUTE) {
    return { nudge: false, reason: 'Already nudged recently (cooldown)' };
  }

  const lastCheck = state.lastCheckedAt[place.id];
  if (lastCheck !== undefined && t - lastCheck < r.skipIfCheckedWithinMinutes * MINUTE) {
    return { nudge: false, reason: 'You already checked your stuff before leaving' };
  }

  if (itemsForToday(place.items, now).length === 0) {
    return { nudge: false, reason: 'Nothing on the list for today' };
  }

  return { nudge: true };
}

/** Items that apply today (day-specific items like "gym bag on Tuesdays"). */
export function itemsForToday(items: Item[], now: Date): Item[] {
  const day = now.getDay() as Weekday;
  return items.filter((i) => !i.days || i.days.length === 0 || i.days.includes(day));
}

/** How many times each item was forgotten at this place. */
export function missCounts(history: CheckRecord[], placeId: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rec of history) {
    if (rec.placeId !== placeId) continue;
    for (const id of rec.missing) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** Today's checklist, with the things you forget most at the top. */
export function smartChecklist(place: Place, history: CheckRecord[], now: Date): (Item & { misses: number })[] {
  const counts = missCounts(history, place.id);
  return itemsForToday(place.items, now)
    .map((i) => ({ ...i, misses: counts[i.id] ?? 0 }))
    .sort((a, b) => b.misses - a.misses);
}

/** The words in the notification. Calls out your most-forgotten item when there is one. */
export function nudgeMessage(place: Place, history: CheckRecord[], now: Date): { title: string; body: string } {
  const list = smartChecklist(place, history, now);
  const top = list[0];
  const title = `Leaving ${place.name}? ${place.emoji}`;
  if (top && top.misses >= 2) {
    return { title, body: `Heads up: you have left your ${top.label.toLowerCase()} here ${top.misses} times. Tap to check your stuff.` };
  }
  const preview = list.slice(0, 4).map((i) => i.emoji).join(' ');
  return { title, body: `Quick check: ${preview}  Tap to confirm you have everything.` };
}

/** Distance in meters between two points (haversine). Used for the "simulate" tool and sanity checks. */
export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
