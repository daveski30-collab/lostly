// The "is this worth it?" numbers shown on the home screen.

import type { CheckRecord } from './types';

const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export type Stats = {
  /** Times Lostly caught something you were about to leave behind. */
  saves: number;
  /** Consecutive days (ending today or yesterday) with checks and nothing forgotten. */
  streakDays: number;
  /** Total checklists completed. */
  checks: number;
};

export function computeStats(history: CheckRecord[], now: Date): Stats {
  const saves = history.filter((h) => h.missing.length > 0).length;

  // Per day: did you check, and did you miss anything?
  const days = new Map<string, boolean>(); // dayKey -> clean (nothing missing)
  for (const h of history) {
    const k = dayKey(h.at);
    days.set(k, (days.get(k) ?? true) && h.missing.length === 0);
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
