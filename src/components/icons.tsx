// One consistent icon set (Ionicons line icons) for items, places, and the interface.
// Custom items Will types himself fall back to the emoji he picked.

import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Text } from 'react-native';
import type { Item, Place } from '../lib/types';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export const ITEM_ICONS: Record<string, IconName> = {
  keys: 'key-outline',
  wallet: 'wallet-outline',
  phone: 'phone-portrait-outline',
  watch: 'watch-outline',
  jacket: 'shirt-outline',
  earbuds: 'headset-outline',
  charger: 'battery-charging-outline',
  laptop: 'laptop-outline',
  backpack: 'bag-handle-outline',
  water: 'water-outline',
  lunch: 'fast-food-outline',
  glasses: 'glasses-outline',
  id: 'id-card-outline',
  homework: 'book-outline',
  gymbag: 'barbell-outline',
  gloves: 'hand-left-outline',
  umbrella: 'umbrella-outline',
  meds: 'medkit-outline',
  ball: 'basketball-outline',
  carkeys: 'car-outline',
};

export const PLACE_ICONS: Record<string, IconName> = {
  home: 'home-outline',
  school: 'school-outline',
  gym: 'barbell-outline',
  work: 'briefcase-outline',
  practice: 'basketball-outline',
  friend: 'people-outline',
};

// Places are stored with an emoji; map the preset ones to icons.
const PLACE_BY_EMOJI: Record<string, IconName> = {
  '🏠': 'home-outline',
  '🏫': 'school-outline',
  '🏋️': 'barbell-outline',
  '💼': 'briefcase-outline',
  '🏀': 'basketball-outline',
  '🛋️': 'people-outline',
  '📍': 'location-outline',
  '🧪': 'flask-outline',
};

export function ItemGlyph({ item, size = 24, color }: { item: Pick<Item, 'id' | 'emoji'>; size?: number; color: string }) {
  const name = ITEM_ICONS[item.id];
  if (name) return <Icon name={name} size={size} color={color} />;
  if (item.id.startsWith('once-')) return <Icon name="create-outline" size={size} color={color} />;
  return <Text style={{ fontSize: size * 0.9, lineHeight: size * 1.1 }}>{item.emoji}</Text>;
}

export function PlaceGlyph({ place, size = 24, color }: { place: Pick<Place, 'emoji'>; size?: number; color: string }) {
  const name = PLACE_BY_EMOJI[place.emoji];
  if (name) return <Icon name={name} size={size} color={color} />;
  return <Text style={{ fontSize: size * 0.9, lineHeight: size * 1.1 }}>{place.emoji}</Text>;
}
