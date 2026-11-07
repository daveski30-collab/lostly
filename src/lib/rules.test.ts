import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, distanceMeters, inHourWindow, nudgeMessage, shouldNudgeOnExit, smartChecklist } from './rules';
import type { Place, VisitState } from './types';

const MIN = 60_000;
// Tuesday, Nov 10 2026, 3:00 PM local
const tue3pm = new Date(2026, 10, 10, 15, 0);

const gym: Place = {
  id: 'gym',
  name: 'Gym',
  emoji: '🏀',
  location: { latitude: 40.04, longitude: -75.39 },
  radiusMeters: 150,
  items: [
    { id: 'keys', label: 'Keys', emoji: '🔑' },
    { id: 'wallet', label: 'Wallet', emoji: '👛' },
    { id: 'bag', label: 'Gym bag', emoji: '🎒', days: [2, 4] },
  ],
  rules: { ...DEFAULT_RULES },
};

const empty = (): VisitState => ({ enteredAt: {}, lastNudgedAt: {}, lastCheckedAt: {} });

describe('shouldNudgeOnExit', () => {
  it('nudges by default', () => {
    expect(shouldNudgeOnExit(gym, empty(), tue3pm)).toEqual({ nudge: true });
  });

  it('skips a quick drive-by (dwell)', () => {
    const s = empty();
    s.enteredAt.gym = tue3pm.getTime() - 2 * MIN;
    expect(shouldNudgeOnExit(gym, s, tue3pm).nudge).toBe(false);
    s.enteredAt.gym = tue3pm.getTime() - 20 * MIN;
    expect(shouldNudgeOnExit(gym, s, tue3pm).nudge).toBe(true);
  });

  it('respects cooldown', () => {
    const s = empty();
    s.lastNudgedAt.gym = tue3pm.getTime() - 10 * MIN;
    expect(shouldNudgeOnExit(gym, s, tue3pm).nudge).toBe(false);
  });

  it('skips if checklist was just completed', () => {
    const s = empty();
    s.lastCheckedAt.gym = tue3pm.getTime() - 3 * MIN;
    expect(shouldNudgeOnExit(gym, s, tue3pm).nudge).toBe(false);
  });

  it('respects active days and hours, including overnight windows', () => {
    expect(shouldNudgeOnExit({ ...gym, rules: { ...DEFAULT_RULES, activeDays: [1, 3, 5] } }, empty(), tue3pm).nudge).toBe(false);
    expect(shouldNudgeOnExit({ ...gym, rules: { ...DEFAULT_RULES, activeHours: { start: 7, end: 12 } } }, empty(), tue3pm).nudge).toBe(false);
    expect(inHourWindow(23, { start: 22, end: 6 })).toBe(true);
    expect(inHourWindow(3, { start: 22, end: 6 })).toBe(true);
    expect(inHourWindow(12, { start: 22, end: 6 })).toBe(false);
  });

  it('respects the off switch', () => {
    expect(shouldNudgeOnExit({ ...gym, rules: { ...DEFAULT_RULES, enabled: false } }, empty(), tue3pm).nudge).toBe(false);
  });
});

describe('smart checklist', () => {
  it('shows day-specific items only on their days and sorts most-forgotten first', () => {
    const history = [
      { placeId: 'gym', at: 0, missing: ['wallet'] },
      { placeId: 'gym', at: 1, missing: ['wallet', 'keys'] },
      { placeId: 'home', at: 2, missing: ['keys', 'keys'] },
    ];
    const list = smartChecklist(gym, history, tue3pm);
    expect(list.map((i) => i.id)).toEqual(['wallet', 'keys', 'bag']);
    const wed = new Date(2026, 10, 11, 15, 0);
    expect(smartChecklist(gym, [], wed).map((i) => i.id)).not.toContain('bag');
    expect(nudgeMessage(gym, history, tue3pm).body).toContain('wallet here 2 times');
  });
});

it('measures distance', () => {
  const d = distanceMeters({ latitude: 40, longitude: -75 }, { latitude: 40.001, longitude: -75 });
  expect(Math.round(d)).toBe(111);
});

describe('weather and one-time items', () => {
  const coat = { ...gym, items: [
    { id: 'keys', label: 'Keys', emoji: '🔑' },
    { id: 'jacket', label: 'Jacket', emoji: '🧥', when: 'cold' as const },
    { id: 'umbrella', label: 'Umbrella', emoji: '☂️', when: 'rain' as const },
  ] };

  it('shows jacket only when cold and umbrella only when rain is likely', () => {
    const warmDry = smartChecklist(coat, [], tue3pm, { tempF: 72, rainChance: 5 }).map((i) => i.id);
    expect(warmDry).toEqual(['keys']);
    const coldWet = smartChecklist(coat, [], tue3pm, { tempF: 41, rainChance: 70 }).map((i) => i.id);
    expect(coldWet).toEqual(expect.arrayContaining(['keys', 'jacket', 'umbrella']));
    // Weather unknown: show everything, to be safe.
    expect(smartChecklist(coat, [], tue3pm, null)).toHaveLength(3);
  });

  it('calls out the weather in the nudge', () => {
    expect(nudgeMessage(coat, [], tue3pm, { tempF: 60, rainChance: 80 }).body).toContain('80% chance of rain');
  });

  it('one-time items go first, get called out, and override day/hour/dwell rules', () => {
    const p = { ...gym, extras: [{ id: 'once-1', label: 'Permission slip', emoji: '📝' }], rules: { ...DEFAULT_RULES, activeDays: [1] as Place['rules']['activeDays'] } };
    const s = empty();
    s.enteredAt.gym = tue3pm.getTime() - 60_000;
    expect(shouldNudgeOnExit(p, s, tue3pm)).toEqual({ nudge: true });
    expect(smartChecklist(p, [], tue3pm)[0].id).toBe('once-1');
    expect(nudgeMessage(p, [], tue3pm).body).toContain('Permission slip');
    // Still respects the off switch.
    expect(shouldNudgeOnExit({ ...p, rules: { ...p.rules, enabled: false } }, s, tue3pm).nudge).toBe(false);
  });
});
