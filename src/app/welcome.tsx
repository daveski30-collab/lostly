// First-run setup: an intro, then three taps-only steps. No typing.

import * as Location from 'expo-location';
import { Stack, router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Icon, ItemGlyph, PLACE_ICONS } from '../components/icons';
import { Button, C, Chip, F, IconButton, s as ui } from '../components/ui';
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

  const back = () => setStep(step - 1);

  if (step === 0) {
    return (
      <View style={st.intro}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={st.introMid}>
          <View style={st.mark}>
            <Icon name="key" size={54} color={C.onAccent} />
          </View>
          <Text style={st.wordmark}>lostly</Text>
          <Text style={st.introTitle}>Never leave your stuff behind.</Text>
          <Text style={st.introSub}>A quick nudge when you leave a place, only when it actually matters.</Text>
        </View>
        <View style={st.introFoot}>
          <Button label="Get started" onPress={() => setStep(1)} />
          <Text style={st.fine}>Takes about 20 seconds. No account needed.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={st.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={st.topBar}>
        <IconButton name="chevron-back" label="Back" onPress={back} />
        <View style={st.segments}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[st.segment, i <= step && { backgroundColor: C.accent }]} />
          ))}
        </View>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView contentContainerStyle={st.page}>
        {step === 1 && (
          <>
            <Text style={st.title}>What do you always grab on the way out?</Text>
            <Text style={st.sub}>Pick everything you carry. You can change it later.</Text>
            <View style={ui.grid}>
              {ITEM_LIBRARY.map((i) => (
                <Chip key={i.id} glyph={(c) => <ItemGlyph item={i} size={28} color={c} />} label={i.label} on={items.has(i.id)} onPress={() => setItems(toggle(items, i.id))} />
              ))}
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={st.title}>Where should Lostly look out for you?</Text>
            <Text style={st.sub}>Each place comes with smart rules, so nudges only show up when they are useful.</Text>
            <View style={ui.grid}>
              {PLACE_PRESETS.map((p) => (
                <Chip
                  key={p.key}
                  glyph={(c) => <Icon name={PLACE_ICONS[p.key] ?? 'location-outline'} size={28} color={c} />}
                  label={p.name}
                  sub={p.note}
                  on={places.has(p.key)}
                  onPress={() => setPlaces(toggle(places, p.key))}
                />
              ))}
            </View>
          </>
        )}

        {step === 3 && (
          <View style={st.last}>
            <View style={[st.mark, { backgroundColor: C.card2 }]}>
              <Icon name={places.has('home') ? 'home' : 'location'} size={46} color={C.accent} />
            </View>
            <Text style={[st.title, { textAlign: 'center' }]}>{places.has('home') ? 'Are you home right now?' : 'You are all set'}</Text>
            <Text style={[st.sub, { textAlign: 'center' }]}>
              {places.has('home')
                ? 'Say yes and Lostly saves this spot as Home. Your other places get saved with one tap the next time you are there.'
                : 'Next time you are at one of your places, open Lostly and tap the pin to save it.'}
            </Text>
            {msg ? <Text style={[st.sub, { color: C.coral, textAlign: 'center' }]}>{msg}</Text> : null}
          </View>
        )}
      </ScrollView>

      <View style={st.footer}>
        {step === 1 && <Button label={`Continue with ${items.size} item${items.size === 1 ? '' : 's'}`} onPress={() => setStep(2)} disabled={items.size === 0} />}
        {step === 2 && <Button label={`Continue with ${places.size} place${places.size === 1 ? '' : 's'}`} onPress={() => setStep(3)} disabled={places.size === 0} />}
        {step === 3 &&
          (places.has('home') ? (
            <>
              <Button icon="navigate" label={busy ? 'Saving…' : 'Yes, save Home here'} onPress={() => finish(true)} disabled={busy} />
              <Button kind="ghost" label="Not right now" onPress={() => finish(false)} disabled={busy} />
            </>
          ) : (
            <Button label={busy ? 'Saving…' : 'Start using Lostly'} onPress={() => finish(false)} disabled={busy} />
          ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  intro: { flex: 1, backgroundColor: C.bg, padding: 24, justifyContent: 'space-between', maxWidth: 560, width: '100%', alignSelf: 'center' },
  introMid: { flex: 1, justifyContent: 'center', gap: 14 },
  mark: { width: 96, height: 96, borderRadius: 30, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }], marginBottom: 10 },
  wordmark: { fontFamily: F.heavy, fontSize: 22, color: C.muted, letterSpacing: -0.5 },
  introTitle: { fontFamily: F.heavy, fontSize: 48, lineHeight: 48, color: C.ink, letterSpacing: -2 },
  introSub: { fontSize: 17, color: C.muted, lineHeight: 24, maxWidth: 340 },
  introFoot: { gap: 12, paddingBottom: 16 },
  fine: { textAlign: 'center', color: C.muted, fontSize: 13 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
  segments: { flex: 1, flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: C.card2 },
  page: { padding: 20, paddingTop: 12, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 24 },
  title: { fontSize: 32, lineHeight: 34, fontFamily: F.heavy, color: C.ink, letterSpacing: -1 },
  sub: { fontSize: 15, color: C.muted, lineHeight: 21, marginBottom: 6 },
  last: { alignItems: 'center', gap: 14, paddingTop: 48 },
  footer: { padding: 16, paddingBottom: 28, gap: 4, backgroundColor: C.bg, width: '100%', maxWidth: 560, alignSelf: 'center' },
});
