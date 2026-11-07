// Saves everything on the device (AsyncStorage = localStorage on the web).
// Nothing leaves the phone. No account, no server.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { newId } from './ids';
import type { CheckRecord, Item, LeftBehind, Place, VisitState } from './types';

const KEYS = { places: 'lostly.places', visit: 'lostly.visit', history: 'lostly.history', log: 'lostly.log', onboarded: 'lostly.onboarded', left: 'lostly.left' };

export type LogEntry = { at: number; placeId: string; text: string };

export { newId };

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

export async function getPlaces(): Promise<Place[]> {
  return read<Place[]>(KEYS.places, []);
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

/** Remove a place and every trace of it (used by the Test Lab to clean up after itself). */
export async function purgePlace(id: string) {
  await deletePlace(id);
  await write(KEYS.history, (await getHistory()).filter((h) => h.placeId !== id));
  await write(KEYS.log, (await getLog()).filter((l) => l.placeId !== id));
  await write(KEYS.left, (await getLeft()).filter((l) => l.placeId !== id));
  const v = await getVisit();
  delete v.enteredAt[id];
  delete v.lastNudgedAt[id];
  delete v.lastCheckedAt[id];
  await saveVisit(v);
}

/** Start over: wipes everything on this device. */
export async function resetAll() {
  await AsyncStorage.multiRemove([...Object.values(KEYS), 'lostly.handled']);
  listeners.forEach((l) => l());
}

export const getVisit = () => read<VisitState>(KEYS.visit, { enteredAt: {}, lastNudgedAt: {}, lastCheckedAt: {} });
export const saveVisit = (v: VisitState) => write(KEYS.visit, v);

export const getHistory = () => read<CheckRecord[]>(KEYS.history, []);
export async function addCheck(input: Omit<CheckRecord, 'at'> & { at?: number }) {
  const rec: CheckRecord = { ...input, at: input.at ?? Date.now() };
  const h = await getHistory();
  await write(KEYS.history, [...h, rec].slice(-200));
  const v = await getVisit();
  v.lastCheckedAt[rec.placeId] = rec.at;
  await saveVisit(v);
  // One-time items are done once you have checked out of the place.
  const places = await getPlaces();
  const p = places.find((x) => x.id === rec.placeId);
  if (p?.extras?.length) await upsertPlace({ ...p, extras: [] });
}

/** "Just for next time": add a one-off item to a place's next checklist. */
export async function addOneTime(placeId: string, label: string, emoji = '📝') {
  const p = (await getPlaces()).find((x) => x.id === placeId);
  if (!p || !label.trim()) return;
  const item: Item = { id: `once-${newId()}`, label: label.trim(), emoji };
  await upsertPlace({ ...p, extras: [...(p.extras ?? []), item] });
}

export async function removeOneTime(placeId: string, itemId: string) {
  const p = (await getPlaces()).find((x) => x.id === placeId);
  if (p) await upsertPlace({ ...p, extras: (p.extras ?? []).filter((i) => i.id !== itemId) });
}

// Left-behind tracker: what you left where, until you get it back.
export const getLeft = () => read<LeftBehind[]>(KEYS.left, []);
export async function addLeft(placeId: string, items: Item[]) {
  const now = Date.now();
  const add = items.map((i) => ({ id: newId(), label: i.label, emoji: i.emoji, placeId, at: now }));
  await write(KEYS.left, [...(await getLeft()), ...add]);
  // Mark them on the latest check here, so stats only count real saves.
  const h = await getHistory();
  for (let k = h.length - 1; k >= 0; k--) {
    if (h[k].placeId === placeId) {
      h[k] = { ...h[k], left: items.map((i) => i.id) };
      break;
    }
  }
  await write(KEYS.history, h);
}
export async function resolveLeft(id: string) {
  await write(KEYS.left, (await getLeft()).filter((l) => l.id !== id));
}

export const getLog = () => read<LogEntry[]>(KEYS.log, []);
export async function addLog(entry: LogEntry) {
  await write(KEYS.log, [entry, ...(await getLog())].slice(0, 30));
}

export const isOnboarded = () => read<boolean>(KEYS.onboarded, false);
export const setOnboarded = () => write(KEYS.onboarded, true);

/** Notification ids already handled, so a tapped action is never counted twice. */
export async function markHandled(id: string): Promise<boolean> {
  const seen = await read<string[]>('lostly.handled', []);
  if (seen.includes(id)) return false;
  await AsyncStorage.setItem('lostly.handled', JSON.stringify([...seen, id].slice(-50)));
  return true;
}

/** React hook: loads data and refreshes whenever anything is saved. */
export function useLostly() {
  const [data, setData] = useState<{ places: Place[]; history: CheckRecord[]; log: LogEntry[]; left: LeftBehind[] } | null>(null);
  useEffect(() => {
    const load = async () =>
      setData({ places: await getPlaces(), history: await getHistory(), log: await getLog(), left: await getLeft() });
    load();
    listeners.add(load);
    return () => {
      listeners.delete(load);
    };
  }, []);
  return data;
}
