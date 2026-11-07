import * as Location from 'expo-location';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, C, Card, SectionTitle } from '../components/ui';
import { handleEnter, handleExit } from '../lib/engine';
import { enableNudges, notify, nudgesEnabled, supportsBackgroundNudges, syncGeofences } from '../lib/platform';
import { distanceMeters } from '../lib/rules';
import { computeStats } from '../lib/stats';
import { getPlaces, isOnboarded, setOnboarded, upsertPlace, useLostly } from '../lib/store';
import type { Place } from '../lib/types';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ruleSummary(p: Place): string {
  const r = p.rules;
  if (!r.enabled) return 'Nudges off';
  const bits = [`after ${r.minDwellMinutes}+ min`];
  if (r.activeDays.length) bits.push(r.activeDays.length === 5 && !r.activeDays.includes(0) && !r.activeDays.includes(6) ? 'weekdays' : r.activeDays.map((d) => DAY[d]).join(' '));
  if (r.activeHours) bits.push(`${r.activeHours.start}:00 to ${r.activeHours.end}:00`);
  return bits.join(' · ');
}

async function hereNow() {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') throw new Error('Location permission was not given.');
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

export default function Home() {
  const data = useLostly();
  const [onboarded, setOnb] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  useEffect(() => {
    nudgesEnabled().then(setEnabled);
    (async () => {
      if (await isOnboarded()) return setOnb(true);
      // People who set up places before onboarding existed skip it.
      if ((await getPlaces()).length > 0) {
        await setOnboarded();
        return setOnb(true);
      }
      setOnb(false);
    })();
  }, []);

  if (onboarded === false) return <Redirect href="/welcome" />;
  if (!data || onboarded === null) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;

  const stats = computeStats(data.history, new Date());
  const watching = data.places.filter((p) => p.location && p.rules.enabled).length;

  const turnOn = async () => {
    const problem = await enableNudges();
    setBanner(problem);
    const ok = await nudgesEnabled();
    setEnabled(ok);
    if (ok) await syncGeofences(data.places);
  };

  // One tap: "I am at School right now" saves the location. No map, no typing.
  const saveHere = async (p: Place) => {
    setBusy(p.id);
    try {
      const loc = await hereNow();
      await upsertPlace({ ...p, location: loc });
      await syncGeofences(await getPlaces());
      setBanner(`Saved ${p.name}. Lostly will watch it from now on.`);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not get your location.');
    }
    setBusy(null);
  };

  // Manual "I am leaving" check: opens the closest place's list.
  const checkNow = async () => {
    if (data.places.length === 1) return router.push(`/check/${data.places[0].id}`);
    setBusy('check');
    let target = data.places[0];
    try {
      const here = await hereNow();
      const located = data.places.filter((p) => p.location);
      if (located.length) target = located.reduce((a, b) => (distanceMeters(here, a.location!) <= distanceMeters(here, b.location!) ? a : b));
    } catch {}
    setBusy(null);
    router.push(`/check/${target.id}`);
  };

  // Test the rules without walking anywhere.
  const tryLeaving = async (p: Place, stayedMinutes: number) => {
    const now = new Date();
    await handleEnter(p.id, new Date(now.getTime() - stayedMinutes * 60_000));
    const d = await handleExit(p.id, supportsBackgroundNudges ? notify : async () => {}, now);
    if (d.nudge) {
      if (!supportsBackgroundNudges) router.push(`/check/${p.id}`);
      else setBanner('Nudge sent. Check your notifications.');
    } else setBanner(`Lostly stayed quiet: ${d.reason}.`);
  };

  const nameOf = (id: string) => data.places.find((p) => p.id === id)?.name ?? 'A place';

  return (
    <ScrollView contentContainerStyle={st.page}>
      {data.places.length > 0 && (
        <Pressable onPress={checkNow} style={({ pressed }) => [st.leave, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <Text style={st.leaveEmoji}>🚪</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.leaveTitle}>{busy === 'check' ? 'Finding your place…' : 'Leaving now?'}</Text>
            <Text style={st.leaveSub}>Tap for a 3-second check of your stuff</Text>
          </View>
          <Text style={st.leaveChev}>›</Text>
        </Pressable>
      )}

      {stats.checks > 0 ? (
        <View style={st.stats}>
          <Stat big={`🔥 ${stats.streakDays}`} label={stats.streakDays === 1 ? 'day streak' : 'day streak'} />
          <Stat big={`🛟 ${stats.saves}`} label={stats.saves === 1 ? 'thing saved' : 'things saved'} />
          <Stat big={`✅ ${stats.checks}`} label="checks" />
        </View>
      ) : null}

      <Card style={enabled ? { backgroundColor: C.greenSoft, borderColor: C.greenSoft } : undefined}>
        {supportsBackgroundNudges ? (
          enabled ? (
            <Text style={st.status}>✅ Nudges are on. Watching {watching} place{watching === 1 ? '' : 's'}.</Text>
          ) : (
            <>
              <Text style={st.status}>Nudges are off, so Lostly cannot remind you yet.</Text>
              <Button label="Turn on nudges" onPress={turnOn} />
            </>
          )
        ) : (
          <Text style={st.status}>🌐 Web preview. Automatic nudges need the phone app. {"\u201C"}Leaving now?{"\u201D"} works here too.</Text>
        )}
        {banner ? <Text style={st.banner}>{banner}</Text> : null}
      </Card>

      <SectionTitle>Your places</SectionTitle>
      {data.places.map((p) => (
        <Card key={p.id}>
          <Pressable onPress={() => router.push(`/place/${p.id}`)} style={st.placeHead} accessibilityRole="button" accessibilityLabel={`Edit ${p.name}`}>
            <Text style={st.placeEmoji}>{p.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.placeName}>{p.name}</Text>
              <Text style={st.placeMeta}>{p.location ? ruleSummary(p) : 'Not saved yet'}</Text>
            </View>
            <Text style={st.chev}>›</Text>
          </Pressable>
          <Text style={st.items}>{p.items.map((i) => i.emoji).join('  ')}</Text>
          {!p.location && (
            <Button kind="secondary" label={busy === p.id ? 'Saving…' : `📍 I'm at ${p.name} now`} onPress={() => saveHere(p)} disabled={busy === p.id} />
          )}
          {testing === p.id ? (
            <View style={st.tryRow}>
              <Button kind="ghost" label="Left after 1 hr" onPress={() => tryLeaving(p, 60)} />
              <Button kind="ghost" label="Quick drive-by" onPress={() => tryLeaving(p, 1)} />
            </View>
          ) : (
            <Pressable onPress={() => setTesting(p.id)}>
              <Text style={st.testLink}>Test the smart rules</Text>
            </Pressable>
          )}
        </Card>
      ))}
      <Button kind="ghost" label="+ Add a place" onPress={() => router.push('/place/new')} />

      {data.log.length > 0 && (
        <>
          <SectionTitle>Why Lostly did what it did</SectionTitle>
          <Card>
            {data.log.slice(0, 8).map((l, i) => (
              <Text key={i} style={st.log}>
                <Text style={{ fontWeight: '700' }}>{nameOf(l.placeId)}</Text> · {new Date(l.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {l.text}
              </Text>
            ))}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <View style={st.stat}>
      <Text style={st.statBig}>{big}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  leave: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.accent, borderRadius: 22, padding: 18 },
  leaveEmoji: { fontSize: 34 },
  leaveTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  leaveSub: { fontSize: 14, color: '#FFE5DA', marginTop: 2 },
  leaveChev: { fontSize: 32, color: '#fff' },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.line, paddingVertical: 12, alignItems: 'center' },
  statBig: { fontSize: 20, fontWeight: '900', color: C.ink },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 2 },
  status: { fontSize: 15, color: C.ink, fontWeight: '600', lineHeight: 21 },
  banner: { fontSize: 14, color: C.ink, backgroundColor: '#FFF3C4', padding: 10, borderRadius: 10 },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeEmoji: { fontSize: 32 },
  placeName: { fontSize: 18, fontWeight: '800', color: C.ink },
  placeMeta: { fontSize: 13, color: C.muted, marginTop: 2 },
  chev: { fontSize: 28, color: C.muted },
  items: { fontSize: 22, letterSpacing: 2 },
  tryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  testLink: { color: C.muted, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  log: { fontSize: 13, color: C.ink, lineHeight: 19 },
});
