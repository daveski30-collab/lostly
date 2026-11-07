// The smart nudge engine. Pure functions with no phone stuff, so they are easy to test.
// Every rule is a reason NOT to bother you. If none of them apply, you get a nudge.

import type { CheckRecord, Item, NudgeDecision, NudgeRules, Place, VisitState, Weather, Weekday } from './types';

const MINUTE = 60_000;

export const MIN_RADIUS_METERS = 100;

/** Below this, "cold" items (jacket, hat) show up. */
export const COLD_F = 55;
/** At or above this chance of rain in the next few hours, "rain" items (umbrella) show up. */
export const RAIN_PCT = 40;

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

/**
 * Decide whether leaving `place` right now deserves a nudge.
 * A one-time item ("permission slip") is important enough to skip the day, hour, and stay-length rules.
 */
export function shouldNudgeOnExit(place: Place, state: VisitState, now: Date, weather: Weather | null = null): NudgeDecision {
  const r = place.rules;
  const t = now.getTime();
  const hasOneTime = (place.extras ?? []).length > 0;

  if (!r.enabled) return { nudge: false, reason: 'Nudges are turned off for this place' };

  if (!hasOneTime) {
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
  }

  const lastNudge = state.lastNudgedAt[place.id];
  if (lastNudge !== undefined && t - lastNudge < r.cooldownMinutes * MINUTE) {
    return { nudge: false, reason: 'Already nudged recently (cooldown)' };
  }

  const lastCheck = state.lastCheckedAt[place.id];
  if (lastCheck !== undefined && t - lastCheck < r.skipIfCheckedWithinMinutes * MINUTE) {
    return { nudge: false, reason: 'You already checked your stuff before leaving' };
  }

  if (itemsForToday(allItems(place), now, weather).length === 0) {
    return { nudge: false, reason: 'Nothing on the list for today' };
  }

  return { nudge: true };
}

/** Regular items plus any one-time "just for next time" items. */
export const allItems = (place: Place): Item[] => [...place.items, ...(place.extras ?? [])];

/** Does the weather call for this item? Unknown weather = show it, to be safe. */
export function weatherWants(item: Item, weather: Weather | null): boolean {
  if (!item.when || !weather) return true;
  if (item.when === 'cold') return weather.tempF < COLD_F;
  return weather.rainChance >= RAIN_PCT;
}

/** Items that apply right now: the right day of the week, and the right weather. */
export function itemsForToday(items: Item[], now: Date, weather: Weather | null = null): Item[] {
  const day = now.getDay() as Weekday;
  return items.filter((i) => (!i.days || i.days.length === 0 || i.days.includes(day)) && weatherWants(i, weather));
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
export function smartChecklist(place: Place, history: CheckRecord[], now: Date, weather: Weather | null = null): (Item & { misses: number; oneTime: boolean })[] {
  const counts = missCounts(history, place.id);
  const oneTime = new Set((place.extras ?? []).map((i) => i.id));
  return itemsForToday(allItems(place), now, weather)
    .map((i) => ({ ...i, misses: counts[i.id] ?? 0, oneTime: oneTime.has(i.id) }))
    // One-time items first (easy to forget), then most-forgotten.
    .sort((a, b) => Number(b.oneTime) - Number(a.oneTime) || b.misses - a.misses);
}

/** The words in the notification. Calls out your most-forgotten item when there is one. */
export function nudgeMessage(place: Place, history: CheckRecord[], now: Date, weather: Weather | null = null): { title: string; body: string } {
  const list = smartChecklist(place, history, now, weather);
  const top = list[0];
  const title = `Leaving ${place.name}? ${place.emoji}`;
  if (top?.oneTime) {
    return { title, body: `Don't forget: ${top.emoji} ${top.label} (just for today). Tap to check your stuff.` };
  }
  const weatherItems = weather ? list.filter((i) => i.when) : [];
  if (weatherItems.length && weather) {
    const cold = weatherItems.some((i) => i.when === 'cold');
    const rain = weatherItems.some((i) => i.when === 'rain');
    const why = [cold && `${Math.round(weather.tempF)}°F`, rain && `${weather.rainChance}% chance of rain`].filter(Boolean).join(' and ');
    const what = weatherItems.map((i) => `${i.label.toLowerCase()} ${i.emoji}`).join(' and ');
    return { title, body: `${why}: grab your ${what}. Tap to check the rest.` };
  }
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
