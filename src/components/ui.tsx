// Small building blocks reused across screens, plus the design tokens.
// Look: midnight violet, one loud electric-yellow action, mint for "got it", coral for "left behind".

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Weekday } from '../lib/types';

export const C = {
  bg: '#15122E',
  card: '#211D45',
  card2: '#2B2657',
  ink: '#F4F2FF',
  muted: '#9D98CC',
  line: '#353068',
  accent: '#FFD84D', // electric yellow: the one loud thing
  onAccent: '#15122E',
  accentSoft: 'rgba(255,216,77,0.14)',
  green: '#5CF2B5', // mint: you have it
  greenSoft: 'rgba(92,242,181,0.14)',
  coral: '#FF7A6B', // left behind
  coralSoft: 'rgba(255,122,107,0.14)',
  sky: 'rgba(130,170,255,0.16)',
};

/** Bricolage Grotesque for headlines and buttons; system font for body text. */
export const F = {
  heavy: 'BricolageGrotesque_800ExtraBold',
  bold: 'BricolageGrotesque_700Bold',
  semi: 'BricolageGrotesque_600SemiBold',
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
      style={({ pressed }) => [s.btn, s[`btn_${kind}`], pressed && { transform: [{ scale: 0.97 }] }, disabled && { opacity: 0.45 }]}
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
      <Text style={[s.label, { flex: 1 }]}>{label}</Text>
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
            <Text style={[s.dayText, on && { color: C.onAccent }]}>{d}</Text>
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
        <View style={[s.knob, value && { transform: [{ translateX: 18 }], backgroundColor: C.onAccent }]} />
      </View>
    </Pressable>
  );
}

/** A tappable emoji tile used for picking items and places. */
export function Chip({ emoji, label, on, onPress, sub }: { emoji: string; label: string; on: boolean; onPress: () => void; sub?: string }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.chip, on && s.chipOn, pressed && { transform: [{ scale: 0.96 }] }]}
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
  card: { backgroundColor: C.card, borderRadius: 24, padding: 16, gap: 10 },
  btn: { borderRadius: 999, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center' },
  btn_primary: { backgroundColor: C.accent },
  btn_secondary: { backgroundColor: C.accentSoft },
  btn_ghost: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: C.line },
  btn_danger: { backgroundColor: C.coralSoft },
  btnText: { fontSize: 16, fontFamily: F.bold },
  btnText_primary: { color: C.onAccent },
  btnText_secondary: { color: C.accent },
  btnText_ghost: { color: C.ink },
  btnText_danger: { color: C.coral },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 },
  label: { fontSize: 15, color: C.ink, fontWeight: '600' },
  hint: { fontSize: 13, color: C.muted, marginTop: 2, lineHeight: 18 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.card2, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { fontSize: 20, color: C.accent, fontWeight: '700', marginTop: -2 },
  stepVal: { minWidth: 64, textAlign: 'center', fontSize: 16, fontFamily: F.bold, color: C.ink },
  days: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card2 },
  dayOn: { backgroundColor: C.accent },
  dayText: { fontFamily: F.bold, color: C.ink },
  track: { width: 46, height: 28, borderRadius: 14, backgroundColor: C.card2, padding: 4 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: C.muted },
  chip: { width: '31%', flexGrow: 1, minWidth: 92, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', backgroundColor: C.card, gap: 3 },
  chipOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  chipEmoji: { fontSize: 30 },
  chipLabel: { fontSize: 14, fontFamily: F.bold, color: C.ink },
  chipSub: { fontSize: 11, color: C.muted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { fontSize: 20, fontFamily: F.heavy, color: C.ink, marginTop: 14, letterSpacing: -0.3 },
});
