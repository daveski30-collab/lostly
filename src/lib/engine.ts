// Glue between the phone's location events and the rules. Shared by the phone and the web "simulate" button.

import { nudgeMessage, shouldNudgeOnExit } from './rules';
import { addLog, getHistory, getPlaces, getVisit, saveVisit } from './store';
import type { NudgeDecision } from './types';

export async function handleEnter(placeId: string, now = new Date()) {
  const visit = await getVisit();
  visit.enteredAt[placeId] = now.getTime();
  await saveVisit(visit);
  await addLog({ at: now.getTime(), placeId, text: 'Arrived' });
}

/**
 * Called when you leave a place. Runs the rules and, if a nudge is earned,
 * calls `notify` with the message. Returns the decision so the UI can explain it.
 */
export async function handleExit(
  placeId: string,
  notify: (msg: { title: string; body: string; placeId: string }) => Promise<void>,
  now = new Date(),
): Promise<NudgeDecision> {
  const place = (await getPlaces()).find((p) => p.id === placeId);
  if (!place) return { nudge: false, reason: 'Unknown place' };

  const visit = await getVisit();
  const decision = shouldNudgeOnExit(place, visit, now);

  if (decision.nudge) {
    const msg = nudgeMessage(place, await getHistory(), now);
    await notify({ ...msg, placeId });
    visit.lastNudgedAt[placeId] = now.getTime();
  }
  visit.enteredAt[placeId] = undefined;
  await saveVisit(visit);
  await addLog({ at: now.getTime(), placeId, text: decision.nudge ? 'Left: nudged you' : `Left: stayed quiet (${decision.reason})` });
  return decision;
}
