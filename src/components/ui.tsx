// Small building blocks reused across screens.

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Weekday } from '../lib/types';

export const C = {
  bg: '#FFF8F0',
  card: '#FFFFFF',
  ink: '#1F2430',
  muted: '#767B87',
  line: '#EFE4D6',
  accent: '#FF6B3D',
  accentSoft: '#FFE5DA',
  green: '#1E9E62',
  greenSoft: '#DDF5E8',
};

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, s[`btn_${kind}`], (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={[s.btnText, s[`btnText_${kind}`]]}>{label}</Text>
    </Pressable>
  );
}

export function Stepper({ label, value, onChange, step = 1, min = 0, max = 999, unit = '' }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; unit?: string;
}) {
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <View style={s.stepper}>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.max(min, value - step))} accessibilityLabel={`Decrease ${label}`}>
          <Text style={s.stepBtnText}>−</Text>
        </Pressable>
        <Text style={s.stepVal}>{value}{unit}</Text>
        <Pressable style={s.stepBtn} onPress={() => onChange(Math.min(max, value + step))} accessibilityLabel={`Increase ${label}`}>
          <Text style={s.stepBtnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function DayPicker({ value, onChange }: { value: Weekday[]; onChange: (v: Weekday[]) => void }) {
  return (
    <View style={s.days}>
      {DAY_LETTERS.map((d, i) => {
        const on = value.includes(i as Weekday);
        return (
          <Pressable
            key={i}
            onPress={() => onChange(on ? value.filter((x) => x !== i) : ([...value, i] as Weekday[]).sort())}
            style={[s.day, on && s.dayOn]}
            accessibilityLabel={`Toggle day ${i}`}
          >
            <Text style={[s.dayText, on && { color: '#fff' }]}>{d}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Toggle({ label, value, onChange, hint }: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <Pressable style={s.row} onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <View style={[s.track, value && { backgroundColor: C.green }]}>
        <View style={[s.knob, value && { transform: [{ translateX: 18 }] }]} />
      </View>
    </Pressable>
  );
}

/** A tappable emoji tile used for picking items and places. */
export function Chip({ emoji, label, on, onPress, sub }: { emoji: string; label: string; on: boolean; onPress: () => void; sub?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.chip, on && s.chipOn]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
    >
      <Text style={s.chipEmoji}>{emoji}</Text>
      <Text style={[s.chipLabel, on && { color: C.accent }]} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={s.chipSub} numberOfLines={2}>{sub}</Text> : null}
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={s.section}>{children}</Text>;
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: C.line, gap: 10 },
  btn: { borderRadius: 14, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center' },
  btn_primary: { backgroundColor: C.accent },
  btn_secondary: { backgroundColor: C.accentSoft },
  btn_ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  btn_danger: { backgroundColor: '#FDE2E2' },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnText_primary: { color: '#fff' },
  btnText_secondary: { color: C.accent },
  btnText_ghost: { color: C.ink },
  btnText_danger: { color: '#C0392B' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  label: { fontSize: 15, color: C.ink, fontWeight: '600' },
  hint: { fontSize: 13, color: C.muted, marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, color: C.accent, fontWeight: '700', marginTop: -2 },
  stepVal: { minWidth: 64, textAlign: 'center', fontSize: 15, fontWeight: '700', color: C.ink },
  days: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  day: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  dayOn: { backgroundColor: C.accent, borderColor: C.accent },
  dayText: { fontWeight: '700', color: C.ink },
  track: { width: 44, height: 26, borderRadius: 13, backgroundColor: '#D9D4CC', padding: 3 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  chip: { width: '31%', flexGrow: 1, minWidth: 92, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, borderRadius: 16, borderWidth: 2, borderColor: C.line, backgroundColor: '#fff', gap: 2 },
  chipOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  chipEmoji: { fontSize: 28 },
  chipLabel: { fontSize: 13, fontWeight: '700', color: C.ink },
  chipSub: { fontSize: 11, color: C.muted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { fontSize: 13, fontWeight: '800', color: C.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 8 },
});
