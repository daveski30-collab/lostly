import { describe, expect, it } from 'vitest';
import { placeFromPreset } from './presets';
import { shouldNudgeOnExit } from './rules';
import { computeStats } from './stats';

const at = (d: number, h = 9) => new Date(2026, 10, d, h).getTime();

describe('computeStats', () => {
  it('counts saves and clean-day streaks', () => {
    const history = [
      { placeId: 'a', at: at(3), missing: ['keys'] }, // a save, breaks day 3
      { placeId: 'a', at: at(4), missing: [] },
      { placeId: 'a', at: at(5), missing: [] },
      { placeId: 'a', at: at(6), missing: [] },
    ];
    expect(computeStats(history, new Date(2026, 10, 6, 20))).toEqual({ saves: 1, streakDays: 3, checks: 4 });
    // Not checked yet today: streak still counts through yesterday.
    expect(computeStats(history, new Date(2026, 10, 7, 8)).streakDays).toBe(3);
    // Skipped a whole day: streak resets.
    expect(computeStats(history, new Date(2026, 10, 8, 8)).streakDays).toBe(0);
  });
});

describe('presets', () => {
  it('school is quiet on weekends and mornings', () => {
    const school = placeFromPreset('school', { latitude: 0, longitude: 0 });
    const empty = { enteredAt: {}, lastNudgedAt: {}, lastCheckedAt: {} };
    expect(shouldNudgeOnExit(school, empty, new Date(2026, 10, 7, 15)).nudge).toBe(false); // Saturday
    expect(shouldNudgeOnExit(school, empty, new Date(2026, 10, 9, 8)).nudge).toBe(false); // Monday 8am
    expect(shouldNudgeOnExit(school, empty, new Date(2026, 10, 9, 15)).nudge).toBe(true); // Monday 3pm
  });
});
