import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, C } from '../../components/ui';
import { smartChecklist } from '../../lib/rules';
import { addCheck, useLostly } from '../../lib/store';

export default function Checklist() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useLostly();
  const [have, setHave] = useState<Set<string>>(new Set());
  const [missing, setMissing] = useState<string[] | null>(null);

  const place = data?.places.find((p) => p.id === id);
  const list = useMemo(() => (place && data ? smartChecklist(place, data.history, new Date()) : []), [place, data]);

  if (!data) return null;
  if (!place) return <Text style={{ padding: 20 }}>Place not found.</Text>;

  const toggle = (itemId: string) => {
    const next = new Set(have);
    next.has(itemId) ? next.delete(itemId) : next.add(itemId);
    setHave(next);
  };

  const finish = async (all: boolean) => {
    const miss = all ? [] : list.filter((i) => !have.has(i.id)).map((i) => i.id);
    await addCheck({ placeId: place.id, at: Date.now(), missing: miss });
    if (miss.length === 0) router.back();
    else setMissing(miss);
  };

  if (missing) {
    const names = list.filter((i) => missing.includes(i.id));
    return (
      <View style={st.done}>
        <Text style={st.bigEmoji}>🏃</Text>
        <Text style={st.title}>Go grab:</Text>
        {names.map((i) => (
          <Text key={i.id} style={st.grab}>{i.emoji} {i.label}</Text>
        ))}
        <Text style={st.sub}>Lostly will remember and put these at the top next time.</Text>
        <Button label="Got them, thanks" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={st.page}>
      <Stack.Screen options={{ title: `Leaving ${place.name}` }} />
      <Text style={st.title}>Tap what you have {place.emoji}</Text>
      <View style={st.grid}>
        {list.map((i) => {
          const on = have.has(i.id);
          return (
            <Pressable key={i.id} onPress={() => toggle(i.id)} style={[st.tile, on && st.tileOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
              <Text style={st.tileEmoji}>{i.emoji}</Text>
              <Text style={[st.tileLabel, on && { color: C.green }]}>{i.label}</Text>
              {i.misses > 0 && !on ? <Text style={st.warn}>Forgot {i.misses}×</Text> : null}
              {on ? <Text style={st.check}>✓</Text> : null}
            </Pressable>
          );
        })}
      </View>
      <Button label={have.size === list.length ? 'All set! 🎉' : `Done (${have.size}/${list.length})`} onPress={() => finish(false)} />
      <Button kind="ghost" label="I have everything" onPress={() => finish(true)} />
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { padding: 16, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '900', color: C.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '47%', flexGrow: 1, minHeight: 110, backgroundColor: '#fff', borderRadius: 20, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center', padding: 12, gap: 4 },
  tileOn: { borderColor: C.green, backgroundColor: C.greenSoft },
  tileEmoji: { fontSize: 38 },
  tileLabel: { fontSize: 16, fontWeight: '700', color: C.ink },
  warn: { fontSize: 12, fontWeight: '700', color: C.accent },
  check: { position: 'absolute', top: 8, right: 12, fontSize: 18, color: C.green, fontWeight: '900' },
  done: { flex: 1, padding: 24, gap: 10, justifyContent: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' },
  bigEmoji: { fontSize: 56 },
  grab: { fontSize: 22, fontWeight: '700', color: C.ink },
  sub: { fontSize: 14, color: C.muted, marginVertical: 8 },
});
