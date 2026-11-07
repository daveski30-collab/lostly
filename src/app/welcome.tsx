// First-run setup: three taps-only steps, no typing.

import * as Location from 'expo-location';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, C, Chip, s as ui } from '../components/ui';
import { enableNudges, supportsBackgroundNudges, syncGeofences } from '../lib/platform';
import { ITEM_LIBRARY, PLACE_PRESETS, placeFromPreset } from '../lib/presets';
import { savePlaces, setOnboarded } from '../lib/store';
import type { Place } from '../lib/types';

const toggle = (set: Set<string>, k: string) => {
  const n = new Set(set);
  if (n.has(k)) n.delete(k);
  else n.add(k);
  return n;
};

export default function Welcome() {
  const [step, setStep] = useState(0);
  const [items, setItems] = useState(new Set(['keys', 'wallet', 'phone']));
  const [places, setPlaces] = useState(new Set(['home']));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const finish = async (atHome: boolean) => {
    setBusy(true);
    let here: Place['location'] = null;
    if (atHome) {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          here = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        }
      } catch {}
    }

    // Everyday items go on every place; each place also keeps its own extras.
    const everyday = ITEM_LIBRARY.filter((i) => items.has(i.id));
    const built = PLACE_PRESETS.filter((p) => places.has(p.key)).map((p) => {
      const place = placeFromPreset(p.key, p.key === 'home' ? here : null);
      const extras = p.key === 'home' ? [] : place.items.filter((i) => !items.has(i.id));
      return { ...place, items: [...everyday.map((i) => ({ ...i })), ...extras] };
    });
    await savePlaces(built);
    await setOnboarded();

    if (supportsBackgroundNudges) {
      const problem = await enableNudges();
      if (problem) setMsg(problem);
      await syncGeofences(built);
    }
    setBusy(false);
    router.replace('/');
  };

  return (
    <View style={st.screen}>
    <ScrollView contentContainerStyle={st.page}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={st.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[st.dot, i <= step && { backgroundColor: C.accent }]} />
        ))}
      </View>

      {step === 0 && (
        <>
          <Text style={st.big}>🔑👛⌚</Text>
          <Text style={st.title}>What do you always need when you leave?</Text>
          <Text style={st.sub}>Tap everything you carry. You can change this anytime.</Text>
          <View style={ui.grid}>
            {ITEM_LIBRARY.map((i) => (
              <Chip key={i.id} emoji={i.emoji} label={i.label} on={items.has(i.id)} onPress={() => setItems(toggle(items, i.id))} />
            ))}
          </View>
        </>
      )}

      {step === 1 && (
        <>
          <Text style={st.big}>📍</Text>
          <Text style={st.title}>Where should Lostly watch?</Text>
          <Text style={st.sub}>Each place comes with smart rules, so you only get nudged when it matters.</Text>
          <View style={ui.grid}>
            {PLACE_PRESETS.map((p) => (
              <Chip key={p.key} emoji={p.emoji} label={p.name} sub={p.note} on={places.has(p.key)} onPress={() => setPlaces(toggle(places, p.key))} />
            ))}
          </View>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={st.big}>🏠</Text>
          <Text style={st.title}>{places.has('home') ? 'Are you home right now?' : 'Almost done!'}</Text>
          <Text style={st.sub}>
            {places.has('home')
              ? 'If yes, Lostly saves this spot as Home. Other places get saved the next time you are there (one tap).'
              : 'Next time you are at one of your places, open Lostly and tap the 📍 button to save it.'}
          </Text>
          {places.has('home') ? (
            <>
              <Button label={busy ? 'Saving…' : 'Yes, save Home here'} onPress={() => finish(true)} disabled={busy} />
              <Button kind="ghost" label="Not right now" onPress={() => finish(false)} disabled={busy} />
            </>
          ) : (
            <Button label={busy ? 'Saving…' : 'Start using Lostly'} onPress={() => finish(false)} disabled={busy} />
          )}
          {msg ? <Text style={st.sub}>{msg}</Text> : null}
          <Button kind="ghost" label="Back" onPress={() => setStep(1)} />
        </>
      )}
    </ScrollView>
    {step < 2 && (
      <View style={st.footer}>
        {step === 0 ? (
          <Button label={`Next (${items.size} picked)`} onPress={() => setStep(1)} disabled={items.size === 0} />
        ) : (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}><Button kind="ghost" label="Back" onPress={() => setStep(0)} /></View>
            <View style={{ flex: 2 }}><Button label={`Next (${places.size} place${places.size === 1 ? '' : 's'})`} onPress={() => setStep(2)} disabled={places.size === 0} /></View>
          </View>
        )}
      </View>
    )}
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  footer: { padding: 16, paddingBottom: 28, borderTopWidth: 1, borderColor: C.line, backgroundColor: C.bg, width: '100%', maxWidth: 560, alignSelf: 'center' },
  page: { padding: 20, paddingTop: 48, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 24 },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { width: 28, height: 6, borderRadius: 3, backgroundColor: C.line },
  big: { fontSize: 44, textAlign: 'center', marginTop: 8 },
  title: { fontSize: 26, fontWeight: '900', color: C.ink, textAlign: 'center' },
  sub: { fontSize: 15, color: C.muted, textAlign: 'center', lineHeight: 21 },
});
