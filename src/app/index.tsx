import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, C, Card, SectionTitle } from '../components/ui';
import { handleEnter, handleExit } from '../lib/engine';
import { enableNudges, notify, nudgesEnabled, supportsBackgroundNudges, syncGeofences } from '../lib/platform';
import { useLostly } from '../lib/store';
import type { Place } from '../lib/types';

const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ruleSummary(p: Place): string {
  const r = p.rules;
  if (!r.enabled) return 'Nudges off';
  const bits = [`after ${r.minDwellMinutes}+ min`];
  if (r.activeDays.length) bits.push(r.activeDays.map((d) => DAY[d]).join(' '));
  if (r.activeHours) bits.push(`${r.activeHours.start}:00 to ${r.activeHours.end}:00`);
  return bits.join(' · ');
}

export default function Home() {
  const data = useLostly();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    nudgesEnabled().then(setEnabled);
  }, []);

  if (!data) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;

  const turnOn = async () => {
    const problem = await enableNudges();
    setBanner(problem);
    const ok = await nudgesEnabled();
    setEnabled(ok);
    if (ok) await syncGeofences(data.places);
  };

  // Test the rules without walking anywhere: pretend you arrived (optionally) and left.
  const tryLeaving = async (p: Place, stayedMinutes: number | null) => {
    const now = new Date();
    if (stayedMinutes !== null) await handleEnter(p.id, new Date(now.getTime() - stayedMinutes * 60_000));
    const d = await handleExit(p.id, supportsBackgroundNudges ? notify : async () => {}, now);
    if (d.nudge) {
      if (!supportsBackgroundNudges) router.push(`/check/${p.id}`);
      else setBanner('Nudge sent. Check your notifications.');
    } else setBanner(`Lostly stayed quiet: ${d.reason}.`);
  };

  const nameOf = (id: string) => data.places.find((p) => p.id === id)?.name ?? 'A place';

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.hero}>Never leave your stuff behind.</Text>
      <Text style={st.sub}>Lostly nudges you when you leave a place, but only when it actually matters.</Text>

      <Card style={enabled ? { backgroundColor: C.greenSoft, borderColor: C.greenSoft } : undefined}>
        {supportsBackgroundNudges ? (
          enabled ? (
            <Text style={st.status}>✅ Nudges are on. Lostly is watching {data.places.filter((p) => p.location && p.rules.enabled).length} place(s).</Text>
          ) : (
            <>
              <Text style={st.status}>Nudges are off</Text>
              <Button label="Turn on nudges" onPress={turnOn} />
            </>
          )
        ) : (
          <Text style={st.status}>🌐 Web preview. Real nudges need the phone app; use "Try leaving" to test your rules.</Text>
        )}
        {banner ? <Text style={st.banner}>{banner}</Text> : null}
      </Card>

      <SectionTitle>Your places</SectionTitle>
      {data.places.map((p) => (
        <Card key={p.id}>
          <Pressable onPress={() => router.push(`/place/${p.id}`)} style={st.placeHead}>
            <Text style={st.placeEmoji}>{p.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={st.placeName}>{p.name}</Text>
              <Text style={st.placeMeta}>{p.location ? ruleSummary(p) : '📍 Location not set yet, tap to set it'}</Text>
            </View>
            <Text style={st.chev}>›</Text>
          </Pressable>
          <Text style={st.items}>{p.items.map((i) => i.emoji).join('  ')}</Text>
          <View style={st.tryRow}>
            <Button kind="secondary" label="Try leaving" onPress={() => tryLeaving(p, 60)} />
            <Button kind="ghost" label="Drive-by" onPress={() => tryLeaving(p, 1)} />
          </View>
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

const st = StyleSheet.create({
  page: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  hero: { fontSize: 28, fontWeight: '900', color: C.ink, marginTop: 4 },
  sub: { fontSize: 15, color: C.muted, marginBottom: 4, lineHeight: 21 },
  status: { fontSize: 15, color: C.ink, fontWeight: '600', lineHeight: 21 },
  banner: { fontSize: 14, color: C.ink, backgroundColor: '#FFF3C4', padding: 10, borderRadius: 10 },
  placeHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  placeEmoji: { fontSize: 32 },
  placeName: { fontSize: 18, fontWeight: '800', color: C.ink },
  placeMeta: { fontSize: 13, color: C.muted, marginTop: 2 },
  chev: { fontSize: 28, color: C.muted },
  items: { fontSize: 22, letterSpacing: 2 },
  tryRow: { flexDirection: 'row', gap: 8 },
  log: { fontSize: 13, color: C.ink, lineHeight: 19 },
});
