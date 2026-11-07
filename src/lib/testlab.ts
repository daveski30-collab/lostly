// Test Lab: runs Lostly's core scenarios on a throwaway "Test spot" with fake time and fake weather,
// and reports what happened next to what should happen. Your real places and history are untouched.

import { handleEnter, handleExit, type Notify, type NotifyMsg } from './engine';
import { DEFAULT_RULES, smartChecklist } from './rules';
import { addCheck, addLeft, getHistory, getPlaces, getVisit, purgePlace, saveVisit, upsertPlace } from './store';
import type { Place, Weather } from './types';
import { setWeatherOverride } from './weather';

export const TEST_ID = 'test-spot';
const MIN = 60_000;

export const isTestPlace = (p: { id: string }) => p.id === TEST_ID;

export function testPlace(patch: Partial<Place> = {}): Place {
  return {
    id: TEST_ID,
    name: 'Test spot',
    emoji: '🧪',
    location: null, // never watched by the phone
    radiusMeters: 150,
    items: [
      { id: 'keys', label: 'Keys', emoji: '🔑' },
      { id: 'wallet', label: 'Wallet', emoji: '👛' },
      { id: 'jacket', label: 'Jacket', emoji: '🧥', when: 'cold' },
      { id: 'umbrella', label: 'Umbrella', emoji: '☂️', when: 'rain' },
    ],
    rules: { ...DEFAULT_RULES, minDwellMinutes: 10, cooldownMinutes: 30, skipIfCheckedWithinMinutes: 10 },
    ...patch,
  };
}

export type Result = { name: string; expect: string; got: string; pass: boolean };

type Scenario = { name: string; expect: string; run: (ctx: Ctx) => Promise<{ got: string; pass: boolean }> };
type Ctx = { sent: NotifyMsg[]; notify: Notify };

const WARM: Weather = { tempF: 72, rainChance: 5 };
const COLD_WET: Weather = { tempF: 41, rainChance: 75 };

async function fresh(patch: Partial<Place> = {}) {
  await purgePlace(TEST_ID);
  await upsertPlace(testPlace(patch));
}

async function stayed(minutes: number, now = new Date()) {
  const v = await getVisit();
  v.enteredAt[TEST_ID] = now.getTime() - minutes * MIN;
  await saveVisit(v);
}

const describe = (sent: NotifyMsg[], from: number) => {
  const m = sent.slice(from);
  return m.length ? `Nudged: "${m[m.length - 1].body}"` : 'Stayed quiet';
};

/** A window of hours that does not include right now, so "outside active hours" is always true. */
function hoursExcludingNow(now = new Date()) {
  const start = (now.getHours() + 2) % 24;
  return { start, end: (start + 2) % 24 };
}

export const SCENARIOS: Scenario[] = [
  {
    name: 'Leave after a long stay',
    expect: 'Nudge',
    run: async ({ sent, notify }) => {
      await fresh();
      setWeatherOverride(WARM);
      await stayed(60);
      const n = sent.length;
      const d = await handleExit(TEST_ID, notify);
      return { got: describe(sent, n), pass: d.nudge };
    },
  },
  {
    name: 'Quick drive-by (2 min)',
    expect: 'Stay quiet',
    run: async ({ sent, notify }) => {
      await fresh();
      await stayed(2);
      const n = sent.length;
      const d = await handleExit(TEST_ID, notify);
      return { got: d.nudge ? describe(sent, n) : `Stayed quiet: ${d.reason}`, pass: !d.nudge };
    },
  },
  {
    name: 'Leave twice in a row',
    expect: 'Nudge once, then stay quiet',
    run: async ({ sent, notify }) => {
      await fresh();
      setWeatherOverride(WARM);
      await stayed(60);
      const a = await handleExit(TEST_ID, notify);
      await stayed(60);
      const b = await handleExit(TEST_ID, notify);
      return { got: `First: ${a.nudge ? 'nudged' : 'quiet'}. Second: ${b.nudge ? 'nudged' : `quiet (${(b as { reason: string }).reason})`}`, pass: a.nudge && !b.nudge };
    },
  },
  {
    name: 'Checked your stuff, then left',
    expect: 'Stay quiet',
    run: async ({ sent, notify }) => {
      await fresh();
      await stayed(60);
      await addCheck({ placeId: TEST_ID, missing: [] });
      const n = sent.length;
      const d = await handleExit(TEST_ID, notify);
      return { got: d.nudge ? describe(sent, n) : `Stayed quiet: ${d.reason}`, pass: !d.nudge };
    },
  },
  {
    name: 'Leave outside active hours',
    expect: 'Stay quiet',
    run: async ({ sent, notify }) => {
      await fresh({ rules: { ...testPlace().rules, activeHours: hoursExcludingNow() } });
      await stayed(60);
      const n = sent.length;
      const d = await handleExit(TEST_ID, notify);
      return { got: d.nudge ? describe(sent, n) : `Stayed quiet: ${d.reason}`, pass: !d.nudge };
    },
  },
  {
    name: 'One-time item, even outside active hours',
    expect: 'Nudge about the permission slip',
    run: async ({ sent, notify }) => {
      await fresh({
        rules: { ...testPlace().rules, activeHours: hoursExcludingNow() },
        extras: [{ id: 'once-test', label: 'Permission slip', emoji: '📝' }],
      });
      setWeatherOverride(WARM);
      await stayed(1);
      const n = sent.length;
      const d = await handleExit(TEST_ID, notify);
      const body = sent.slice(n).at(-1)?.body ?? '';
      return { got: describe(sent, n), pass: d.nudge && body.includes('Permission slip') };
    },
  },
  {
    name: 'Cold and rainy',
    expect: 'Jacket and umbrella on the list, nudge mentions rain',
    run: async ({ sent, notify }) => {
      await fresh();
      setWeatherOverride(COLD_WET);
      await stayed(60);
      const n = sent.length;
      await handleExit(TEST_ID, notify);
      const place = (await getPlaces()).find((p) => p.id === TEST_ID)!;
      const ids = smartChecklist(place, await getHistory(), new Date(), COLD_WET).map((i) => i.id);
      const body = sent.slice(n).at(-1)?.body ?? '';
      return { got: `List: ${ids.join(', ')}. ${describe(sent, n)}`, pass: ids.includes('jacket') && ids.includes('umbrella') && body.includes('rain') };
    },
  },
  {
    name: 'Warm and dry',
    expect: 'No jacket or umbrella on the list',
    run: async () => {
      await fresh();
      const place = (await getPlaces()).find((p) => p.id === TEST_ID)!;
      const ids = smartChecklist(place, [], new Date(), WARM).map((i) => i.id);
      return { got: `List: ${ids.join(', ')}`, pass: !ids.includes('jacket') && !ids.includes('umbrella') };
    },
  },
  {
    name: 'Left your wallet, then came back',
    expect: '"Your stuff is here" alert',
    run: async ({ sent, notify }) => {
      await fresh();
      await addLeft(TEST_ID, [{ id: 'wallet', label: 'Wallet', emoji: '👛' }]);
      const n = sent.length;
      await handleEnter(TEST_ID, notify);
      const m = sent.slice(n).at(-1);
      return { got: m ? `Alert: "${m.body}"` : 'No alert', pass: !!m && m.kind === 'found' && m.body.includes('Wallet') };
    },
  },
];

/**
 * Run every scenario. `deliver` is called for each message Lostly would send; on a phone, pass the real
 * notifier to see actual notifications pop up.
 */
export async function runAll(deliver?: Notify, onProgress?: (r: Result[]) => void): Promise<Result[]> {
  const sent: NotifyMsg[] = [];
  const notify: Notify = async (m) => {
    sent.push(m);
    if (deliver) await deliver(m);
  };
  const results: Result[] = [];
  try {
    for (const s of SCENARIOS) {
      setWeatherOverride(null);
      try {
        const r = await s.run({ sent, notify });
        results.push({ name: s.name, expect: s.expect, ...r });
      } catch (e) {
        results.push({ name: s.name, expect: s.expect, got: `Error: ${e instanceof Error ? e.message : String(e)}`, pass: false });
      }
      onProgress?.([...results]);
    }
  } finally {
    setWeatherOverride(undefined);
    await purgePlace(TEST_ID);
  }
  return results;
}

/** Set up the Test spot for a hands-on look at the checklist with chosen weather. */
export async function setupHandsOn(weather: Weather, withOneTime: boolean) {
  await fresh(withOneTime ? { extras: [{ id: 'once-test', label: 'Permission slip', emoji: '📝' }] } : {});
  setWeatherOverride(weather);
}

export async function cleanUp() {
  setWeatherOverride(undefined);
  await purgePlace(TEST_ID);
}

export const WEATHER_PRESETS: { label: string; w: Weather }[] = [
  { label: '🥶 Cold + rain', w: COLD_WET },
  { label: '☀️ Warm + dry', w: WARM },
  { label: '🌥️ Cool, no rain', w: { tempF: 50, rainChance: 10 } },
];
