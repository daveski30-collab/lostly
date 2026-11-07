// The core moment: a 3-second "do I have everything?" check.

import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, C } from '../../components/ui';
import { allItems, smartChecklist, weatherWants } from '../../lib/rules';
import { addCheck, addLeft, useLostly } from '../../lib/store';
import type { Item, Weather } from '../../lib/types';
import { getWeather, weatherLine } from '../../lib/weather';

const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

export default function Checklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useLostly();
  const [have, setHave] = useState<Set<string>>(new Set());
  const [missing, setMissing] = useState<Item[] | null>(null);
  const [fetched, setFetched] = useState<{ weather: Weather | null } | null>(null);

  const place = data?.places.find((p) => p.id === id);
  const needsWeather = !!place && allItems(place).some((i) => i.when);
  const lat = place?.location?.latitude;
  const lon = place?.location?.longitude;

  const canFetch = needsWeather && lat !== undefined && lon !== undefined;

  // Fetch weather once (gives up after ~4s). Without it, weather items just show as normal.
  useEffect(() => {
    if (!canFetch) return;
    let alive = true;
    getWeather({ latitude: lat!, longitude: lon! }).then((w) => {
      if (alive) setFetched({ weather: w });
    });
    return () => {
      alive = false;
    };
  }, [canFetch, lat, lon]);

  const weather = fetched?.weather ?? null;
  // Build the list once and keep it fixed, so tiles never jump around while you tap.
  const ready = !!place && !!data && (!canFetch || fetched !== null);
  const list = useMemo(() => (ready ? smartChecklist(place!, data!.history, new Date(), weather) : null), [ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data) return null;
  if (!place) return <Text style={{ padding: 20 }}>Place not found.</Text>;
  if (!list) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;

  const skipped = weather ? allItems(place).filter((i) => i.when && !weatherWants(i, weather)) : [];

  const toggle = (itemId: string) => {
    const next = new Set(have);
    if (next.has(itemId)) next.delete(itemId);
    else next.add(itemId);
    setHave(next);
  };

  const finish = async (all: boolean) => {
    const miss = all ? [] : list.filter((i) => !have.has(i.id));
    await addCheck({ placeId: place.id, missing: miss.map((i) => i.id) });
    if (miss.length === 0) close();
    else setMissing(miss);
  };

  const leaveWithout = async () => {
    if (missing) await addLeft(place.id, missing);
    close();
  };

  if (missing) {
    return (
      <View style={st.done}>
        <Stack.Screen options={{ title: `Leaving ${place.name}` }} />
        <Text style={st.bigEmoji}>🏃</Text>
        <Text style={st.title}>Go grab:</Text>
        {missing.map((i) => (
          <Text key={i.id} style={st.grab}>
            {i.emoji} {i.label}
          </Text>
        ))}
        <Text style={st.sub}>Lostly will put {missing.length === 1 ? 'this' : 'these'} at the top next time.</Text>
        <Button label="Got them ✓" onPress={close} />
        <Button kind="ghost" label="Leaving without them" onPress={leaveWithout} />
        <Text style={st.hint}>If you leave without them, Lostly remembers where they are and reminds you when you are back at {place.name}.</Text>
      </View>
    );
  }

  const allOn = list.length > 0 && have.size === list.length;

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Stack.Screen options={{ title: `Leaving ${place.name}` }} />
      <Text style={st.title}>Tap what you have {place.emoji}</Text>
      {weather ? <Text style={st.weather}>{weatherLine(weather)}</Text> : null}
      <View style={st.grid}>
        {list.map((i) => {
          const on = have.has(i.id);
          const badge = i.oneTime
            ? '📝 Just for today'
            : i.misses > 0
              ? `Forgot ${i.misses}×`
              : i.when && weather
                ? i.when === 'rain'
                  ? '🌧️ Rain likely'
                  : '🥶 Cold out'
                : null;
          return (
            <Pressable
              key={i.id}
              onPress={() => toggle(i.id)}
              style={[st.tile, i.oneTime && st.tileOnce, on && st.tileOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={i.label}
            >
              <Text style={st.tileEmoji}>{i.emoji}</Text>
              <Text style={[st.tileLabel, on && { color: C.green }]} numberOfLines={2}>
                {i.label}
              </Text>
              {badge && !on ? <Text style={st.badge}>{badge}</Text> : null}
              {on ? <Text style={st.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
      {skipped.length > 0 && <Text style={st.hint}>Not needed today: {skipped.map((i) => `${i.emoji} ${i.label}`).join(', ')}</Text>}
      <Button label={allOn ? 'All set! 🎉' : `Done (${have.size}/${list.length})`} onPress={() => finish(false)} />
      <Button kind="ghost" label="I have everything" onPress={() => finish(true)} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: C.ink },
  weather: { fontSize: 14, color: C.ink, backgroundColor: '#EAF3FF', padding: 10, borderRadius: 12, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', flexGrow: 1, minHeight: 110, backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center', padding: 12, gap: 4 },
  tileOnce: { borderColor: '#F5B700', backgroundColor: '#FFF8DB' },
  tileOn: { borderColor: C.green, backgroundColor: C.greenSoft },
  tileEmoji: { fontSize: 38 },
  tileLabel: { fontSize: 16, fontWeight: '700', color: C.ink, textAlign: 'center' },
  badge: { fontSize: 12, fontWeight: '700', color: C.accent },
  check: { position: 'absolute', top: 8, right: 12, fontSize: 18, color: C.green, fontWeight: '900' },
  hint: { fontSize: 13, color: C.muted, lineHeight: 18 },
  done: { flex: 1, padding: 24, gap: 10, justifyContent: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' },
  bigEmoji: { fontSize: 56 },
  grab: { fontSize: 22, fontWeight: '700', color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginVertical: 8 },
});
