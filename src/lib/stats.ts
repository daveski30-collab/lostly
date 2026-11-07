// The "is this worth it?" numbers shown on the home screen.

import type { CheckRecord } from './types';

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export type Stats = {
  /** Items Lostly caught that you then went back and grabbed. */
  saves: number;
  /** Consecutive days (ending today or yesterday) with a check and nothing actually left behind. */
  streakDays: number;
  /** Total checklists completed. */
  checks: number;
};

export function computeStats(history: CheckRecord[], now: Date): Stats {
  const leftOf = (h: CheckRecord) => new Set(h.left ?? []);
  const saves = history.reduce((n, h) => n + h.missing.filter((id) => !leftOf(h).has(id)).length, 0);

  // Per day: did you check, and did you actually leave anything behind?
  const days = new Map<string, boolean>(); // dayKey -> clean
  for (const h of history) {
    const k = dayKey(h.at);
    days.set(k, (days.get(k) ?? true) && leftOf(h).size === 0);
  }

  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  // Today does not break the streak if you have not checked yet.
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.get(dayKey(cursor.getTime())) === true) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { saves, streakDays: streak, checks: history.length };
}
