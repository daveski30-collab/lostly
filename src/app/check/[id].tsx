// The core moment: a 3-second "do I have everything?" check.

import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bouncy, Button, C, F } from '../../components/ui';
import { success, warn } from '../../lib/haptics';
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
  const [good, setGood] = useState(false);
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
    if (next.size === list.length) success();
    setHave(next);
  };

  const finish = async (all: boolean) => {
    const miss = all ? [] : list.filter((i) => !have.has(i.id));
    await addCheck({ placeId: place.id, missing: miss.map((i) => i.id) });
    if (miss.length === 0) {
      success();
      setGood(true);
      setTimeout(close, 1300);
    } else {
      warn();
      setMissing(miss);
    }
  };

  const leaveWithout = async () => {
    if (missing) await addLeft(place.id, missing);
    close();
  };

  if (good) return <AllGood />;

  if (missing) {
    return (
      <View style={st.done}>
        <Stack.Screen options={{ title: `Leaving ${place.name}` }} />
        <Text style={st.title}>Hold up.{'\n'}Go grab:</Text>
        <View style={st.grabList}>
          {missing.map((i) => (
            <View key={i.id} style={st.grabRow}>
              <Text style={st.grabEmoji}>{i.emoji}</Text>
              <Text style={st.grab}>{i.label}</Text>
            </View>
          ))}
        </View>
        <Button label="Got them" onPress={() => { success(); setGood(true); setTimeout(close, 1300); }} />
        <Button kind="ghost" label="Leaving without them" onPress={leaveWithout} />
        <Text style={st.hint}>Leave without them and Lostly remembers where they are, then pings you when you are back at {place.name}.</Text>
      </View>
    );
  }

  const allOn = list.length > 0 && have.size === list.length;

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Stack.Screen options={{ title: `Leaving ${place.name}` }} />
      <Text style={st.title}>Got everything?</Text>
      <Progress value={list.length ? have.size / list.length : 0} />
      {weather ? <Text style={st.weather}>{weatherLine(weather)}</Text> : null}
      <View style={st.grid}>
        {list.map((i) => {
          const on = have.has(i.id);
          const badge = i.oneTime
            ? 'Just for today'
            : i.misses > 0
              ? `Forgot ${i.misses}×`
              : i.when && weather
                ? i.when === 'rain'
                  ? 'Rain likely'
                  : 'Cold out'
                : null;
          return (
            <Bouncy
              key={i.id}
              onPress={() => toggle(i.id)}
              style={[st.tile, i.oneTime && st.tileOnce, on && st.tileOn]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              accessibilityLabel={i.label}
              scaleTo={0.93}
            >
              <Text style={[st.tileEmoji, on && { opacity: 0.55 }]}>{i.emoji}</Text>
              <Text style={[st.tileLabel, on && { color: C.green }]} numberOfLines={2}>
                {i.label}
              </Text>
              {badge && !on ? <Text style={[st.badge, i.oneTime && { color: C.accent }]}>{badge}</Text> : null}
              {on ? <CheckDot /> : null}
            </Bouncy>
          );
        })}
      </View>
      {skipped.length > 0 && <Text style={st.hint}>Not needed today: {skipped.map((i) => `${i.emoji} ${i.label}`).join(', ')}</Text>}
      <Button label={allOn ? "All set, let's go" : `Done · ${have.size} of ${list.length}`} onPress={() => finish(false)} />
      {!allOn && <Button kind="ghost" label="I have everything" onPress={() => finish(true)} />}
    </ScrollView>
  );
}

const NATIVE = Platform.OS !== 'web';

/** Mint check that pops in when you tap a tile. */
function CheckDot() {
  const s = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.spring(s, { toValue: 1, useNativeDriver: NATIVE, speed: 18, bounciness: 14 }).start();
  }, [s]);
  return (
    <Animated.View style={[st.check, { transform: [{ scale: s }] }]}>
      <Text style={st.checkText}>✓</Text>
    </Animated.View>
  );
}

/** Thin bar that fills as you check items off. */
function Progress({ value }: { value: number }) {
  const v = useState(() => new Animated.Value(value))[0];
  useEffect(() => {
    Animated.spring(v, { toValue: value, useNativeDriver: false, speed: 14, bounciness: 6 }).start();
  }, [value, v]);
  const width = v.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={st.track}>
      <Animated.View style={[st.fill, { width, backgroundColor: value >= 1 ? C.green : C.accent }]} />
    </View>
  );
}

/** The payoff: a big mint check, then back to where you were. */
function AllGood() {
  const s = useState(() => new Animated.Value(0.4))[0];
  const o = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.parallel([
      Animated.spring(s, { toValue: 1, useNativeDriver: NATIVE, speed: 12, bounciness: 16 }),
      Animated.timing(o, { toValue: 1, duration: 180, useNativeDriver: NATIVE }),
    ]).start();
  }, [s, o]);
  return (
    <View style={st.good}>
      <Stack.Screen options={{ headerShown: false }} />
      <Animated.View style={[st.goodCircle, { opacity: o, transform: [{ scale: s }] }]}>
        <Text style={st.goodCheck}>✓</Text>
      </Animated.View>
      <Animated.Text style={[st.goodTitle, { opacity: o }]}>You{'\u2019'}re good.{'\n'}Go.</Animated.Text>
    </View>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 40 },
  title: { fontSize: 36, lineHeight: 38, fontFamily: F.heavy, color: C.ink, letterSpacing: -1.2 },
  track: { height: 8, borderRadius: 4, backgroundColor: C.card, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
  weather: { fontSize: 14, color: C.ink, backgroundColor: C.sky, padding: 12, borderRadius: 16, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexBasis: '45%', flexGrow: 1, minHeight: 128, backgroundColor: C.card, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center', padding: 12, gap: 4 },
  tileOnce: { borderColor: C.accent, backgroundColor: C.accentSoft },
  tileOn: { borderColor: C.green, backgroundColor: C.greenSoft },
  tileEmoji: { fontSize: 44 },
  tileLabel: { fontSize: 17, fontFamily: F.bold, color: C.ink, textAlign: 'center' },
  badge: { fontSize: 12, fontFamily: F.semi, color: C.coral },
  check: { position: 'absolute', top: 10, right: 10, width: 26, height: 26, borderRadius: 13, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: C.onAccent, fontSize: 15, fontWeight: '900' },
  hint: { fontSize: 13, color: C.muted, lineHeight: 18 },
  done: { flex: 1, padding: 24, gap: 12, justifyContent: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' },
  grabList: { gap: 8, marginVertical: 8 },
  grabRow: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.coralSoft, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: C.coral },
  grabEmoji: { fontSize: 30 },
  grab: { fontSize: 22, fontFamily: F.bold, color: C.ink },
  good: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', gap: 28 },
  goodCircle: { width: 150, height: 150, borderRadius: 75, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  goodCheck: { fontSize: 76, color: C.onAccent, fontWeight: '900', marginTop: -4 },
  goodTitle: { fontFamily: F.heavy, fontSize: 40, lineHeight: 42, color: C.ink, textAlign: 'center', letterSpacing: -1.2 },
});
