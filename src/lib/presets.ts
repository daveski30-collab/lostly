// Ready-made items and places so setup is a few taps, not typing.

import { DEFAULT_RULES } from './rules';
import type { Item, NudgeRules, Place } from './types';
import { newId } from './ids';

/** Tap-to-add item library. `id` is stable so the same item means the same thing everywhere. */
export const ITEM_LIBRARY: Omit<Item, 'days'>[] = [
  { id: 'keys', label: 'Keys', emoji: '🔑' },
  { id: 'wallet', label: 'Wallet', emoji: '👛' },
  { id: 'phone', label: 'Phone', emoji: '📱' },
  { id: 'watch', label: 'Watch', emoji: '⌚' },
  { id: 'jacket', label: 'Jacket', emoji: '🧥' },
  { id: 'earbuds', label: 'Earbuds', emoji: '🎧' },
  { id: 'charger', label: 'Charger', emoji: '🔌' },
  { id: 'laptop', label: 'Laptop', emoji: '💻' },
  { id: 'backpack', label: 'Backpack', emoji: '🎒' },
  { id: 'water', label: 'Water bottle', emoji: '🧴' },
  { id: 'lunch', label: 'Lunch', emoji: '🥪' },
  { id: 'glasses', label: 'Glasses', emoji: '👓' },
  { id: 'id', label: 'ID card', emoji: '🪪' },
  { id: 'homework', label: 'Homework', emoji: '📚' },
  { id: 'gymbag', label: 'Gym bag', emoji: '👟' },
  { id: 'hat', label: 'Hat', emoji: '🧢' },
  { id: 'umbrella', label: 'Umbrella', emoji: '☂️' },
  { id: 'meds', label: 'Medicine', emoji: '💊' },
  { id: 'ball', label: 'Ball', emoji: '🏀' },
  { id: 'carkeys', label: 'Car keys', emoji: '🚗' },
];

export const itemById = (id: string) => ITEM_LIBRARY.find((i) => i.id === id);

type PlacePreset = { key: string; name: string; emoji: string; items: string[]; rules: Partial<NudgeRules>; radiusMeters: number; note: string };

/** Each preset ships with sensible smart rules, so nudges are quiet from day one. */
export const PLACE_PRESETS: PlacePreset[] = [
  { key: 'home', name: 'Home', emoji: '🏠', items: ['keys', 'wallet', 'phone', 'watch', 'jacket'], rules: { minDwellMinutes: 15 }, radiusMeters: 150, note: 'After 15+ min at home' },
  { key: 'school', name: 'School', emoji: '🏫', items: ['backpack', 'phone', 'jacket', 'homework', 'water'], rules: { minDwellMinutes: 30, activeDays: [1, 2, 3, 4, 5], activeHours: { start: 11, end: 18 } }, radiusMeters: 250, note: 'Weekday afternoons' },
  { key: 'gym', name: 'Gym', emoji: '🏋️', items: ['phone', 'keys', 'earbuds', 'water', 'gymbag'], rules: { minDwellMinutes: 20 }, radiusMeters: 150, note: 'After a 20+ min workout' },
  { key: 'work', name: 'Work', emoji: '💼', items: ['laptop', 'charger', 'phone', 'keys', 'id'], rules: { minDwellMinutes: 60, activeDays: [1, 2, 3, 4, 5] }, radiusMeters: 200, note: 'Weekdays, after an hour+' },
  { key: 'practice', name: 'Practice', emoji: '🏀', items: ['ball', 'water', 'jacket', 'phone'], rules: { minDwellMinutes: 30 }, radiusMeters: 200, note: 'After 30+ min' },
  { key: 'friend', name: "Friend's house", emoji: '🛋️', items: ['phone', 'charger', 'jacket', 'keys'], rules: { minDwellMinutes: 30 }, radiusMeters: 150, note: 'After 30+ min' },
];

export function placeFromPreset(key: string, location: Place['location'] = null): Place {
  const p = PLACE_PRESETS.find((x) => x.key === key) ?? PLACE_PRESETS[0];
  return {
    id: newId(),
    name: p.name,
    emoji: p.emoji,
    location,
    radiusMeters: p.radiusMeters,
    items: p.items.map((id) => ({ ...itemById(id)! })),
    rules: { ...DEFAULT_RULES, ...p.rules },
  };
}
