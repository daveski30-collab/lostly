import { describe, expect, it } from 'vitest';
import { placeFromPreset } from './presets';
import { shouldNudgeOnExit } from './rules';
import { computeStats } from './stats';
import { parseOpenMeteo } from './weather';

const at = (d: number, h = 9) => new Date(2026, 10, d, h).getTime();

describe('computeStats', () => {
  it('counts saves and clean-day streaks', () => {
    const history = [
      { placeId: 'a', at: at(3), missing: ['keys'], left: ['keys'] }, // actually left behind: breaks day 3
      { placeId: 'a', at: at(4), missing: ['wallet'] }, // caught and grabbed: a save, day stays clean
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

it('parses Open-Meteo responses and tolerates gaps', () => {
  expect(parseOpenMeteo({ current: { temperature_2m: 48.2 }, hourly: { precipitation_probability: [10, null, 65, 30] } })).toEqual({ tempF: 48.2, rainChance: 65 });
  expect(parseOpenMeteo({ current: { temperature_2m: 70 } })).toEqual({ tempF: 70, rainChance: 0 });
  expect(parseOpenMeteo({ error: true })).toBeNull();
});
