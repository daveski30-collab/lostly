import * as Location from 'expo-location';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, C, Card, Chip, DayPicker, SectionTitle, Stepper, Toggle, s as ui } from '../../components/ui';
import { ITEM_LIBRARY, PLACE_PRESETS, placeFromPreset } from '../../lib/presets';
import { syncGeofences } from '../../lib/platform';
import { DEFAULT_RULES, MIN_RADIUS_METERS } from '../../lib/rules';
import { deletePlace, getPlaces, newId, upsertPlace } from '../../lib/store';
import type { Place } from '../../lib/types';

const blank = (): Place => ({
  id: newId(),
  name: '',
  emoji: '📍',
  location: null,
  radiusMeters: 150,
  items: [],
  rules: { ...DEFAULT_RULES },
});

export default function EditPlace() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [place, setPlace] = useState<Place | null>(isNew ? blank() : null);
  const [newItem, setNewItem] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [openDaysFor, setOpenDaysFor] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew) getPlaces().then((all) => setPlace(all.find((p) => p.id === id) ?? null));
  }, [id, isNew]);

  if (!place) return <Text style={{ padding: 20 }}>Place not found.</Text>;

  const set = (patch: Partial<Place>) => setPlace({ ...place, ...patch });
  const setRules = (patch: Partial<Place['rules']>) => set({ rules: { ...place.rules, ...patch } });

  const useHere = async () => {
    setLocMsg('Finding you…');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return setLocMsg('Location permission was not given.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      set({ location: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } });
      setLocMsg(`Saved. Accurate to about ${Math.round(pos.coords.accuracy ?? 0)} m.`);
    } catch {
      setLocMsg('Could not get your location. Try again outside or near a window.');
    }
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    set({ items: [...place.items, { id: newId(), label: newItem.trim(), emoji: newEmoji.trim() || '✅' }] });
    setNewItem('');
    setNewEmoji('');
  };

  const save = async () => {
    await upsertPlace({ ...place, name: place.name.trim() || 'My place' });
    await syncGeofences(await getPlaces());
    router.back();
  };

  const remove = async () => {
    await deletePlace(place.id);
    await syncGeofences(await getPlaces());
    router.back();
  };

  const r = place.rules;

  const onList = new Set(place.items.map((i) => i.id));
  const suggestions = ITEM_LIBRARY.filter((i) => !onList.has(i.id));

  return (
    <ScrollView contentContainerStyle={st.page} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: isNew ? 'New place' : place.name }} />

      {isNew && !place.name && (
        <>
          <SectionTitle>Start from a preset</SectionTitle>
          <View style={ui.grid}>
            {PLACE_PRESETS.map((p) => (
              <Chip key={p.key} emoji={p.emoji} label={p.name} sub={p.note} on={false} onPress={() => setPlace({ ...placeFromPreset(p.key), id: place.id, location: place.location })} />
            ))}
          </View>
          <Text style={st.hint}>Or fill it in yourself below.</Text>
        </>
      )}

      <Card>
        <View style={st.nameRow}>
          <TextInput style={[st.input, st.emojiInput]} value={place.emoji} onChangeText={(v) => set({ emoji: v })} maxLength={4} accessibilityLabel="Place emoji" />
          <TextInput style={[st.input, { flex: 1 }]} value={place.name} onChangeText={(v) => set({ name: v })} placeholder="Name (Home, School, Gym…)" accessibilityLabel="Place name" />
        </View>
        <Button kind="secondary" label={place.location ? '📍 Update to where I am now' : '📍 Set to where I am now'} onPress={useHere} />
        {place.location ? (
          <Text style={st.hint}>Saved at {place.location.latitude.toFixed(5)}, {place.location.longitude.toFixed(5)}</Text>
        ) : null}
        {locMsg ? <Text style={st.hint}>{locMsg}</Text> : null}
        <Stepper label="Leave distance" value={place.radiusMeters} onChange={(v) => set({ radiusMeters: v })} step={50} min={MIN_RADIUS_METERS} max={1000} unit=" m" />
        <Text style={st.hint}>How far you go before it counts as leaving. Bigger means fewer false alarms, smaller means faster nudges.</Text>
      </Card>

      <SectionTitle>Checklist</SectionTitle>
      <Card>
        {place.items.map((it) => (
          <View key={it.id}>
            <View style={st.itemRow}>
              <Text style={st.itemEmoji}>{it.emoji}</Text>
              <Text style={st.itemLabel}>{it.label}</Text>
              <Pressable onPress={() => setOpenDaysFor(openDaysFor === it.id ? null : it.id)}>
                <Text style={st.link}>{it.days?.length ? `${it.days.length} days` : 'Every day'}</Text>
              </Pressable>
              <Pressable onPress={() => set({ items: place.items.filter((x) => x.id !== it.id) })} accessibilityLabel={`Remove ${it.label}`}>
                <Text style={st.remove}>✕</Text>
              </Pressable>
            </View>
            {openDaysFor === it.id && (
              <View style={{ paddingLeft: 40, paddingBottom: 8, gap: 6 }}>
                <Text style={st.hint}>Only remind me on these days (none selected = every day):</Text>
                <DayPicker value={it.days ?? []} onChange={(days) => set({ items: place.items.map((x) => (x.id === it.id ? { ...x, days } : x)) })} />
              </View>
            )}
          </View>
        ))}
        {suggestions.length > 0 && (
          <>
            <Text style={st.hint}>Tap to add:</Text>
            <View style={st.suggest}>
              {suggestions.map((i) => (
                <Pressable key={i.id} style={st.pill} onPress={() => set({ items: [...place.items, { ...i }] })} accessibilityLabel={`Add ${i.label}`}>
                  <Text style={st.pillText}>{i.emoji} {i.label}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
        <View style={st.nameRow}>
          <TextInput style={[st.input, st.emojiInput]} value={newEmoji} onChangeText={setNewEmoji} placeholder="🎒" maxLength={4} accessibilityLabel="New item emoji" />
          <TextInput style={[st.input, { flex: 1 }]} value={newItem} onChangeText={setNewItem} placeholder="Something else…" onSubmitEditing={addItem} returnKeyType="done" accessibilityLabel="New item name" />
        </View>
        <Button kind="ghost" label="+ Add item" onPress={addItem} />
      </Card>

      <SectionTitle>Smart nudge rules</SectionTitle>
      <Card>
        <Toggle label="Nudge me when I leave" value={r.enabled} onChange={(v) => setRules({ enabled: v })} />
        <Stepper label="Only if I stayed at least" value={r.minDwellMinutes} onChange={(v) => setRules({ minDwellMinutes: v })} step={5} max={240} unit=" min" />
        <Text style={st.hint}>Skips nudges when you just drive past or stop for a second.</Text>
        <Stepper label="Quiet time after a nudge" value={r.cooldownMinutes} onChange={(v) => setRules({ cooldownMinutes: v })} step={15} max={720} unit=" min" />
        <Stepper label="Skip if I checked within" value={r.skipIfCheckedWithinMinutes} onChange={(v) => setRules({ skipIfCheckedWithinMinutes: v })} step={5} max={120} unit=" min" />
        <Text style={st.label}>Active days</Text>
        <DayPicker value={r.activeDays} onChange={(v) => setRules({ activeDays: v })} />
        <Text style={st.hint}>None selected = every day.</Text>
        <Toggle
          label="Only during certain hours"
          value={r.activeHours !== null}
          onChange={(v) => setRules({ activeHours: v ? { start: 7, end: 22 } : null })}
        />
        {r.activeHours && (
          <>
            <Stepper label="From" value={r.activeHours.start} onChange={(v) => setRules({ activeHours: { ...r.activeHours!, start: v } })} min={0} max={23} unit=":00" />
            <Stepper label="Until" value={r.activeHours.end} onChange={(v) => setRules({ activeHours: { ...r.activeHours!, end: v } })} min={0} max={23} unit=":00" />
          </>
        )}
      </Card>

      <Button label="Save" onPress={save} />
      {!isNew && <Button kind="danger" label="Delete place" onPress={remove} />}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  nameRow: { flexDirection: 'row', gap: 8 },
  input: { minWidth: 0, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: '#fff', color: C.ink },
  emojiInput: { width: 56, textAlign: 'center', fontSize: 22 },
  hint: { fontSize: 13, color: C.muted, lineHeight: 18 },
  label: { fontSize: 15, color: C.ink, fontWeight: '600' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  itemEmoji: { fontSize: 22, width: 30, textAlign: 'center' },
  itemLabel: { flex: 1, fontSize: 16, color: C.ink },
  link: { color: C.accent, fontWeight: '600', fontSize: 13 },
  suggest: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 999, borderWidth: 1, borderColor: C.line, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: '#fff' },
  pillText: { fontSize: 13, color: C.ink, fontWeight: '600' },
  remove: { color: C.muted, fontSize: 16, paddingHorizontal: 6 },
});
