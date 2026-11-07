// Saves everything on the device (AsyncStorage = localStorage on the web).
// Nothing leaves the phone. No account, no server.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { DEFAULT_RULES } from './rules';
import type { CheckRecord, Place, VisitState } from './types';

const KEYS = { places: 'lostly.places', visit: 'lostly.visit', history: 'lostly.history', log: 'lostly.log' };

export type LogEntry = { at: number; placeId: string; text: string };

export const newId = () => Math.random().toString(36).slice(2, 10);

export function starterPlaces(): Place[] {
  return [
    {
      id: newId(),
      name: 'Home',
      emoji: '🏠',
      location: null,
      radiusMeters: 150,
      items: [
        { id: newId(), label: 'Keys', emoji: '🔑' },
        { id: newId(), label: 'Wallet', emoji: '👛' },
        { id: newId(), label: 'Phone', emoji: '📱' },
        { id: newId(), label: 'Watch', emoji: '⌚' },
        { id: newId(), label: 'Jacket', emoji: '🧥' },
      ],
      rules: { ...DEFAULT_RULES, minDwellMinutes: 15 },
    },
  ];
}

async function read<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function write(key: string, value: unknown) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
  listeners.forEach((l) => l());
}

const listeners = new Set<() => void>();

let seeding: Promise<Place[]> | null = null;

export async function getPlaces(): Promise<Place[]> {
  const raw = await AsyncStorage.getItem(KEYS.places);
  if (raw !== null) return JSON.parse(raw);
  // First launch: create the starter places exactly once, even if two screens ask at the same time.
  seeding ??= (async () => {
    const seed = starterPlaces();
    await write(KEYS.places, seed);
    return seed;
  })();
  return seeding;
}
export const savePlaces = (p: Place[]) => write(KEYS.places, p);

export async function upsertPlace(place: Place) {
  const all = await getPlaces();
  const i = all.findIndex((p) => p.id === place.id);
  if (i >= 0) all[i] = place;
  else all.push(place);
  await savePlaces(all);
}

export async function deletePlace(id: string) {
  await savePlaces((await getPlaces()).filter((p) => p.id !== id));
}

export const getVisit = () => read<VisitState>(KEYS.visit, { enteredAt: {}, lastNudgedAt: {}, lastCheckedAt: {} });
export const saveVisit = (v: VisitState) => write(KEYS.visit, v);

export const getHistory = () => read<CheckRecord[]>(KEYS.history, []);
export async function addCheck(rec: CheckRecord) {
  const h = await getHistory();
  await write(KEYS.history, [...h, rec].slice(-200));
  const v = await getVisit();
  v.lastCheckedAt[rec.placeId] = rec.at;
  await saveVisit(v);
}

export const getLog = () => read<LogEntry[]>(KEYS.log, []);
export async function addLog(entry: LogEntry) {
  await write(KEYS.log, [entry, ...(await getLog())].slice(0, 30));
}

/** React hook: loads data and refreshes whenever anything is saved. */
export function useLostly() {
  const [data, setData] = useState<{ places: Place[]; history: CheckRecord[]; log: LogEntry[] } | null>(null);
  useEffect(() => {
    const load = async () => setData({ places: await getPlaces(), history: await getHistory(), log: await getLog() });
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, []);
  return data;
}
