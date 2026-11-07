// Test lab: prove the core works without walking anywhere.

import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, C, F, SectionTitle, Toggle } from '../components/ui';
import { notify, supportsBackgroundNudges } from '../lib/platform';
import { resetAll } from '../lib/store';
import { cleanUp, runAll, SCENARIOS, setupHandsOn, TEST_ID, WEATHER_PRESETS, type Result } from '../lib/testlab';

export default function TestLab() {
  const [results, setResults] = useState<Result[] | null>(null);
  const [running, setRunning] = useState(false);
  const [real, setReal] = useState(false);
  const [weatherIdx, setWeatherIdx] = useState(0);
  const [oneTime, setOneTime] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);

  const run = async () => {
    setRunning(true);
    setResults([]);
    await runAll(real ? notify : undefined, setResults);
    setRunning(false);
  };

  const handsOn = async () => {
    await setupHandsOn(WEATHER_PRESETS[weatherIdx].w, oneTime);
    router.push(`/check/${TEST_ID}`);
  };

  const passed = results?.filter((r) => r.pass).length ?? 0;
  const done = !!results && !running && results.length === SCENARIOS.length;

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Text style={st.title}>Run every core scenario in two seconds.</Text>
      <Text style={st.sub}>
        Uses a throwaway test spot with fake time and fake weather. Your real places, streak, and history are not touched.
      </Text>

      {supportsBackgroundNudges && (
        <Toggle label="Send real notifications" hint="See the actual nudges pop up on this phone while the tests run." value={real} onChange={setReal} />
      )}
      <Button label={running ? 'Running…' : results ? 'Run again' : `Run all ${SCENARIOS.length} tests`} onPress={run} disabled={running} />

      {done && (
        <View style={[st.summary, { backgroundColor: passed === results!.length ? C.greenSoft : C.coralSoft }]}>
          <Text style={[st.summaryBig, { color: passed === results!.length ? C.green : C.coral }]}>
            {passed}/{results!.length}
          </Text>
          <Text style={st.summaryText}>{passed === results!.length ? 'All scenarios passed.' : 'Some scenarios failed. Details below.'}</Text>
        </View>
      )}

      {results && (
        <View style={st.list}>
          {SCENARIOS.map((s, i) => {
            const r = results[i];
            return (
              <View key={s.name} style={st.row}>
                <View style={[st.mark, r && { backgroundColor: r.pass ? C.green : C.coral }]}>
                  {r ? <Text style={st.markText}>{r.pass ? '✓' : '✕'}</Text> : running ? <ActivityIndicator size="small" color={C.muted} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.name}>{s.name}</Text>
                  <Text style={st.expect}>Should: {s.expect.charAt(0).toLowerCase() + s.expect.slice(1)}</Text>
                  {r ? <Text style={st.got}>{r.got}</Text> : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      <SectionTitle>Try the checklist yourself</SectionTitle>
      <Text style={st.sub}>Pick the weather, then open the checklist the way it appears when you leave.</Text>
      <View style={st.pills}>
        {WEATHER_PRESETS.map((w, i) => (
          <Pressable key={w.label} onPress={() => setWeatherIdx(i)} style={[st.pill, i === weatherIdx && st.pillOn]} accessibilityRole="radio" accessibilityState={{ selected: i === weatherIdx }}>
            <Text style={[st.pillText, i === weatherIdx && { color: C.onAccent }]}>{w.label}</Text>
          </Pressable>
        ))}
      </View>
      <Toggle label="Add a one-time item" hint="Adds a permission slip, like a reminder you set the night before." value={oneTime} onChange={setOneTime} />
      <Button kind="secondary" label="Open the checklist" onPress={handsOn} />
      <Pressable onPress={cleanUp}>
        <Text style={st.link}>Remove the test spot</Text>
      </Pressable>

      <SectionTitle>Start over</SectionTitle>
      <Text style={st.sub}>Erases all places, history, and settings on this device and shows the setup screens again.</Text>
      <Button
        kind="danger"
        label={confirmReset ? 'Tap again to erase everything' : 'Reset Lostly'}
        onPress={async () => {
          if (!confirmReset) return setConfirmReset(true);
          await resetAll();
          router.replace('/welcome');
        }}
      />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, gap: 12, maxWidth: 560, width: '100%', alignSelf: 'center', paddingBottom: 56 },
  title: { fontFamily: F.heavy, fontSize: 30, lineHeight: 33, color: C.ink, letterSpacing: -0.8 },
  sub: { fontSize: 14, color: C.muted, lineHeight: 20 },
  summary: { borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 },
  summaryBig: { fontFamily: F.heavy, fontSize: 36 },
  summaryText: { flex: 1, color: C.ink, fontSize: 15, fontWeight: '600' },
  list: { backgroundColor: C.card, borderRadius: 24, padding: 16, gap: 16 },
  row: { flexDirection: 'row', gap: 12 },
  mark: { width: 26, height: 26, borderRadius: 13, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  markText: { color: C.onAccent, fontWeight: '900', fontSize: 14 },
  name: { fontFamily: F.bold, fontSize: 16, color: C.ink },
  expect: { fontSize: 13, color: C.muted, marginTop: 2 },
  got: { fontSize: 13, color: C.ink, marginTop: 4, lineHeight: 18 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: C.card, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 },
  pillOn: { backgroundColor: C.accent },
  pillText: { color: C.ink, fontFamily: F.semi, fontSize: 14 },
  link: { color: C.muted, fontSize: 13, fontWeight: '600', textAlign: 'center', paddingVertical: 4 },
});
