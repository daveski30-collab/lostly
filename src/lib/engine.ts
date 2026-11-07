// Glue between the phone's location events and the rules. Shared by the phone and the web "test" buttons.

import { nudgeMessage, shouldNudgeOnExit } from './rules';
import { addLog, getHistory, getLeft, getPlaces, getVisit, saveVisit } from './store';
import type { NudgeDecision } from './types';
import { getWeather } from './weather';

export type NotifyMsg = { title: string; body: string; placeId: string; kind: 'leave' | 'found' };
export type Notify = (msg: NotifyMsg) => Promise<void>;

/** Arriving somewhere: remember when (for the dwell rule), and if you left something here, tell you. */
export async function handleEnter(placeId: string, notify?: Notify, now = new Date()) {
  const visit = await getVisit();
  visit.enteredAt[placeId] = now.getTime();
  await saveVisit(visit);

  const here = (await getLeft()).filter((l) => l.placeId === placeId);
  const place = (await getPlaces()).find((p) => p.id === placeId);
  if (here.length && place && notify) {
    const what = here.map((l) => `${l.emoji} ${l.label}`).join(', ');
    await notify({ title: `Your stuff is here! ${place.emoji}`, body: `You left ${what} at ${place.name}. Grab it while you are here.`, placeId, kind: 'found' });
    await addLog({ at: now.getTime(), placeId, text: `Arrived: reminded you to grab ${here.length} left-behind item${here.length === 1 ? '' : 's'}` });
  } else {
    await addLog({ at: now.getTime(), placeId, text: 'Arrived' });
  }
}

/**
 * Leaving a place. Runs the rules and, if a nudge is earned, calls `notify` with the message.
 * Returns the decision so the UI can explain it.
 */
export async function handleExit(placeId: string, notify: Notify, now = new Date()): Promise<NudgeDecision> {
  const place = (await getPlaces()).find((p) => p.id === placeId);
  if (!place) return { nudge: false, reason: 'Unknown place' };

  const visit = await getVisit();
  const weather = place.items.some((i) => i.when) ? await getWeather(place.location) : null;
  const decision = shouldNudgeOnExit(place, visit, now, weather);

  if (decision.nudge) {
    const msg = nudgeMessage(place, await getHistory(), now, weather);
    await notify({ ...msg, placeId, kind: 'leave' });
    visit.lastNudgedAt[placeId] = now.getTime();
  }
  visit.enteredAt[placeId] = undefined;
  await saveVisit(visit);
  await addLog({ at: now.getTime(), placeId, text: decision.nudge ? 'Left: nudged you' : `Left: stayed quiet (${decision.reason})` });
  return decision;
}
