import * as Location from 'expo-location';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, C, Card, F, SectionTitle } from '../components/ui';
import { isTestPlace } from '../lib/testlab';
import { handleEnter, handleExit } from '../lib/engine';
import { enableNudges, notify, nudgesEnabled, supportsBackgroundNudges, syncGeofences } from '../lib/platform';
import { distanceMeters } from '../lib/rules';
import { computeStats } from '../lib/stats';
import { addOneTime, getPlaces, isOnboarded, removeOneTime, resolveLeft, setOnboarded, upsertPlace, useLostly } from '../lib/store';
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
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState('');

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

  const places = data.places.filter((p) => !isTestPlace(p));
  const stats = computeStats(data.history.filter((h) => !isTestPlace({ id: h.placeId })), new Date());
  const watching = places.filter((p) => p.location && p.rules.enabled).length;

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
    if (places.length === 1) return router.push(`/check/${places[0].id}`);
    setBusy('check');
    let target = places[0];
    try {
      const here = await hereNow();
      const located = places.filter((p) => p.location);
      if (located.length) target = located.reduce((a, b) => (distanceMeters(here, a.location!) <= distanceMeters(here, b.location!) ? a : b));
    } catch {}
    setBusy(null);
    router.push(`/check/${target.id}`);
  };

  // Test the rules without walking anywhere.
  const tryLeaving = async (p: Place, stayedMinutes: number) => {
    const now = new Date();
    await handleEnter(p.id, undefined, new Date(now.getTime() - stayedMinutes * 60_000));
    const d = await handleExit(p.id, supportsBackgroundNudges ? notify : async () => {}, now);
    if (d.nudge) {
      if (!supportsBackgroundNudges) router.push(`/check/${p.id}`);
      else setBanner('Nudge sent. Check your notifications.');
    } else setBanner(`Lostly stayed quiet: ${d.reason}.`);
  };

  // Simulate arriving, to see the "your stuff is here" reminder.
  const tryArriving = async (p: Place) => {
    const here = data.left.filter((l) => l.placeId === p.id);
    await handleEnter(p.id, supportsBackgroundNudges ? notify : undefined);
    setBanner(here.length ? `Arriving at ${p.name}: "Your ${here.map((l) => l.label.toLowerCase()).join(', ')} ${here.length === 1 ? 'is' : 'are'} here! Grab it."` : `Arrived at ${p.name}. Nothing left behind here.`);
  };

  const saveNote = async (placeId: string) => {
    await addOneTime(placeId, note);
    setNote('');
    setNoteFor(null);
  };

  const nameOf = (id: string) => data.places.find((p) => p.id === id)?.name ?? 'A place';

  return (
    <ScrollView contentContainerStyle={st.page}>
      <View style={st.top}>
        <Text style={st.wordmark}>lostly</Text>
        <Pressable onPress={() => router.push('/test')} style={st.labPill} accessibilityRole="button" accessibilityLabel="Open test lab">
          <Text style={st.labText}>🧪 Test lab</Text>
        </Pressable>
      </View>

      {places.length > 0 && (
        <Pressable onPress={checkNow} style={({ pressed }) => [st.leave, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button" accessibilityLabel="Leaving now?">
          <Text style={st.leaveTitle}>{busy === 'check' ? 'Finding you…' : 'Leaving\nnow?'}</Text>
          <View style={st.leaveFoot}>
            <Text style={st.leaveSub}>3-second check of your stuff</Text>
            <View style={st.leaveGo}>
              <Text style={st.leaveGoText}>Go</Text>
            </View>
          </View>
          <Text style={st.leaveEmoji}>🔑</Text>
        </Pressable>
      )}

      {stats.checks > 0 ? (
        <View style={st.stats}>
          <Stat big={`${stats.streakDays}`} icon="🔥" label={stats.streakDays === 1 ? 'day streak' : 'day streak'} />
          <View style={st.statDiv} />
          <Stat big={`${stats.saves}`} icon="🛟" label={stats.saves === 1 ? 'thing saved' : 'things saved'} />
          <View style={st.statDiv} />
          <Stat big={`${stats.checks}`} icon="✅" label="checks" />
        </View>
      ) : null}

      {data.left.length > 0 && (
        <View style={st.leftCard}>
          <Text style={st.leftTitle}>Left behind</Text>
          {data.left.map((l) => (
            <View key={l.id} style={st.leftRow}>
              <Text style={st.leftEmoji}>{l.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={st.leftLabel}>{l.label}</Text>
                <Text style={st.placeMeta}>
                  At {nameOf(l.placeId)}, {new Date(l.at).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
              <Pressable onPress={() => resolveLeft(l.id)} style={st.gotBack} accessibilityRole="button" accessibilityLabel={`Got ${l.label} back`}>
                <Text style={st.gotBackText}>Got it</Text>
              </Pressable>
            </View>
          ))}
          <Text style={st.placeMeta}>{supportsBackgroundNudges ? 'Lostly pings you when you are back there.' : 'On the phone, Lostly pings you when you are back there.'}</Text>
        </View>
      )}

      <View style={st.statusRow}>
        <View style={[st.dot, { backgroundColor: enabled ? C.green : supportsBackgroundNudges ? C.coral : C.muted }]} />
        <Text style={st.status}>
          {supportsBackgroundNudges
            ? enabled
              ? `Watching ${watching} place${watching === 1 ? '' : 's'}`
              : 'Nudges are off'
            : 'Web preview: auto-nudges run in the phone app'}
        </Text>
        {supportsBackgroundNudges && !enabled ? (
          <Pressable onPress={turnOn} style={st.turnOn} accessibilityRole="button">
            <Text style={st.turnOnText}>Turn on</Text>
          </Pressable>
        ) : null}
      </View>
      {banner ? <Text style={st.banner}>{banner}</Text> : null}

      <SectionTitle>Your places</SectionTitle>
      {places.map((p) => (
        <Card key={p.id}>
          <Pressable onPress={() => router.push(`/place/${p.id}`)} style={st.placeHead} accessibilityRole="button" accessibilityLabel={`Edit ${p.name}`}>
            <View style={st.placeBadge}>
              <Text style={st.placeEmoji}>{p.emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.placeName}>{p.name}</Text>
              <Text style={st.placeMeta}>{p.location ? ruleSummary(p) : 'Not saved yet'}</Text>
            </View>
            <Text style={st.chev}>›</Text>
          </Pressable>
          <View style={st.itemRow}>
            {p.items.map((i) => (
              <View key={i.id} style={st.itemBubble}>
                <Text style={st.itemEmoji}>{i.emoji}</Text>
              </View>
            ))}
          </View>
          {(p.extras ?? []).map((x) => (
            <View key={x.id} style={st.onceRow}>
              <Text style={st.onceText}>📝 Next time: {x.label}</Text>
              <Pressable onPress={() => removeOneTime(p.id, x.id)} accessibilityLabel={`Remove ${x.label}`}>
                <Text style={st.onceX}>✕</Text>
              </Pressable>
            </View>
          ))}
          {noteFor === p.id ? (
            <View style={st.noteRow}>
              <TextInput
                style={st.noteInput}
                value={note}
                onChangeText={setNote}
                placeholder="Permission slip, library book…"
                placeholderTextColor={C.muted}
                autoFocus
                onSubmitEditing={() => saveNote(p.id)}
                returnKeyType="done"
                accessibilityLabel={`One-time item for ${p.name}`}
              />
              <Button label="Add" onPress={() => saveNote(p.id)} />
            </View>
          ) : null}
          {!p.location && (
            <Button kind="secondary" label={busy === p.id ? 'Saving…' : `📍 I'm at ${p.name} now`} onPress={() => saveHere(p)} disabled={busy === p.id} />
          )}
          {testing === p.id ? (
            <View style={st.tryRow}>
              <Button kind="ghost" label="Left after 1 hr" onPress={() => tryLeaving(p, 60)} />
              <Button kind="ghost" label="Drive-by" onPress={() => tryLeaving(p, 1)} />
              <Button kind="ghost" label="Arrive" onPress={() => tryArriving(p)} />
            </View>
          ) : (
            <View style={st.links}>
              {noteFor !== p.id && (
                <Pressable
                  onPress={() => {
                    setNoteFor(p.id);
                    setNote('');
                  }}
                  accessibilityRole="button"
                >
                  <Text style={st.addOnce}>+ Something for next time</Text>
                </Pressable>
              )}
              <Pressable onPress={() => setTesting(p.id)}>
                <Text style={st.testLink}>Try it</Text>
              </Pressable>
            </View>
          )}
        </Card>
      ))}
      <Button kind="ghost" label="+ Add a place" onPress={() => router.push('/place/new')} />

      {data.log.filter((l) => !isTestPlace({ id: l.placeId })).length > 0 && (
        <>
          <SectionTitle>Activity</SectionTitle>
          <View style={st.logBox}>
            {data.log
              .filter((l) => !isTestPlace({ id: l.placeId }))
              .slice(0, 6)
              .map((l, i) => (
                <View key={i} style={st.logRow}>
                  <Text style={st.logTime}>{new Date(l.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
                  <Text style={st.log}>
                    <Text style={{ fontWeight: '700' }}>{nameOf(l.placeId)}</Text> {l.text.charAt(0).toLowerCase() + l.text.slice(1)}
                  </Text>
                </View>
              ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Stat({ big, icon, label }: { big: string; icon: string; label: string }) {
  return (
    <View style={st.stat}>
      <Text style={st.statBig}>
        {big} <Text style={st.statIcon}>{icon}</Text>
      </Text>
      <Text style={st.statLabel}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, paddingTop: 20, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 56 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 8, paddingBottom: 4 },
  wordmark: { fontFamily: F.heavy, fontSize: 30, color: C.ink, letterSpacing: -1 },
  labPill: { backgroundColor: C.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 },
  labText: { color: C.muted, fontFamily: F.semi, fontSize: 13 },
  leave: { backgroundColor: C.accent, borderRadius: 32, padding: 22, minHeight: 190, justifyContent: 'space-between', overflow: 'hidden' },
  leaveTitle: { fontFamily: F.heavy, fontSize: 52, lineHeight: 52, color: C.onAccent, letterSpacing: -2 },
  leaveFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },
  leaveSub: { fontSize: 15, color: C.onAccent, opacity: 0.75, fontWeight: '600', flex: 1 },
  leaveGo: { backgroundColor: C.onAccent, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 22 },
  leaveGoText: { color: C.accent, fontFamily: F.heavy, fontSize: 16 },
  leaveEmoji: { position: 'absolute', right: -6, top: -4, fontSize: 96, opacity: 0.9, transform: [{ rotate: '-18deg' }] },
  stats: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 24, paddingVertical: 14 },
  stat: { flex: 1, alignItems: 'center' },
  statDiv: { width: 1, backgroundColor: C.line, marginVertical: 4 },
  statBig: { fontSize: 26, fontFamily: F.heavy, color: C.ink },
  statIcon: { fontSize: 18 },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  status: { flex: 1, fontSize: 14, color: C.muted, fontWeight: '600' },
  turnOn: { backgroundColor: C.accent, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  turnOnText: { color: C.onAccent, fontFamily: F.bold, fontSize: 13 },
  banner: { fontSize: 14, color: C.ink, backgroundColor: C.card2, padding: 12, borderRadius: 16, overflow: 'hidden', lineHeight: 20 },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeBadge: { width: 48, height: 48, borderRadius: 16, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  placeEmoji: { fontSize: 26 },
  placeName: { fontSize: 19, fontFamily: F.bold, color: C.ink },
  placeMeta: { fontSize: 13, color: C.muted, marginTop: 2 },
  chev: { fontSize: 28, color: C.muted },
  itemRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  itemBubble: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center' },
  itemEmoji: { fontSize: 19 },
  tryRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  testLink: { color: C.muted, fontSize: 13, fontWeight: '600' },
  leftCard: { backgroundColor: C.coralSoft, borderRadius: 24, padding: 16, gap: 10, borderWidth: 1.5, borderColor: C.coral },
  leftTitle: { fontSize: 18, fontFamily: F.heavy, color: C.coral },
  leftRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  leftEmoji: { fontSize: 28 },
  leftLabel: { fontSize: 16, fontFamily: F.bold, color: C.ink },
  gotBack: { backgroundColor: C.green, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  gotBackText: { color: C.onAccent, fontFamily: F.bold, fontSize: 13 },
  onceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.accentSoft, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 12 },
  onceText: { flex: 1, fontSize: 14, fontWeight: '700', color: C.accent },
  onceX: { color: C.muted, fontSize: 15, paddingHorizontal: 4 },
  noteRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  noteInput: { flex: 1, minWidth: 0, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, backgroundColor: C.bg, color: C.ink },
  links: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 2 },
  addOnce: { color: C.accent, fontSize: 14, fontFamily: F.semi },
  logBox: { gap: 10, paddingHorizontal: 4 },
  logRow: { flexDirection: 'row', gap: 12 },
  logTime: { width: 64, fontSize: 13, color: C.muted },
  log: { flex: 1, fontSize: 13, color: C.ink, lineHeight: 19 },
});
