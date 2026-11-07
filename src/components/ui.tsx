// Small building blocks reused across screens, plus the design tokens.
// Look: midnight violet, one loud electric-yellow action, mint for "got it", coral for "left behind".

import { useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { tick } from '../lib/haptics';
import { Icon, type IconName } from './icons';
import type { Weekday } from '../lib/types';

const NATIVE = Platform.OS !== 'web';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** A pressable that squishes under your thumb and springs back, with a tiny haptic tick. */
export function Bouncy({ style, children, onPress, scaleTo = 0.95, haptic = true, ...rest }: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children: ReactNode; scaleTo?: number; haptic?: boolean }) {
  const scale = useState(() => new Animated.Value(1))[0];
  const to = (v: number) => Animated.spring(scale, { toValue: v, useNativeDriver: NATIVE, speed: 40, bounciness: v === 1 ? 12 : 0 }).start();
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        if (haptic) tick();
        onPress?.(e);
      }}
      style={[style, { transform: [{ scale }] }]}
    >
      {children}
    </AnimatedPressable>
  );
}

export const C = {
  bg: '#15122E',
  card: '#211D45',
  card2: '#2B2657',
  ink: '#F4F2FF',
  muted: '#9D98CC',
  line: '#353068',
  accent: '#FFD84D', // electric yellow: the one loud thing
  onAccent: '#15122E',
  accentSoft: '#2E2853',
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

const BTN_TEXT: Record<string, string> = { primary: C.onAccent, secondary: C.ink, ghost: C.muted, danger: C.coral };

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  icon,
  compact,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  icon?: IconName;
  compact?: boolean;
}) {
  return (
    <Bouncy
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={0.97}
      style={[s.btn, s[`btn_${kind}`], compact && s.btnCompact, disabled && { opacity: 0.4 }]}
    >
      {icon ? <Icon name={icon} size={compact ? 16 : 19} color={BTN_TEXT[kind]} /> : null}
      <Text style={[s.btnText, compact && { fontSize: 14 }, { color: BTN_TEXT[kind] }]}>{label}</Text>
    </Bouncy>
  );
}

/** Round icon-only button for headers and rows. */
export function IconButton({ name, onPress, label, tone = 'muted' }: { name: IconName; onPress: () => void; label: string; tone?: 'muted' | 'accent' | 'green' }) {
  const color = tone === 'accent' ? C.accent : tone === 'green' ? C.green : C.muted;
  return (
    <Bouncy onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={s.iconBtn} scaleTo={0.9}>
      <Icon name={name} size={20} color={color} />
    </Bouncy>
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

/** A tappable tile used for picking items and places. */
export function Chip({ glyph, label, on, onPress, sub }: { glyph: (color: string) => ReactNode; label: string; on: boolean; onPress: () => void; sub?: string }) {
  return (
    <Bouncy onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label}>
      {on ? (
        <View style={s.chipTick}>
          <Icon name="checkmark" size={12} color={C.onAccent} />
        </View>
      ) : null}
      <View style={{ height: 34, justifyContent: 'center' }}>{glyph(on ? C.accent : C.ink)}</View>
      <Text style={[s.chipLabel, on && { color: C.accent }]} numberOfLines={1}>{label}</Text>
      {sub ? <Text style={s.chipSub} numberOfLines={2}>{sub}</Text> : null}
    </Bouncy>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={s.section}>{children}</Text>;
}

export const s = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 24, padding: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  btn: { borderRadius: 18, minHeight: 56, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnCompact: { minHeight: 40, borderRadius: 14, paddingHorizontal: 14 },
  iconBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  chipTick: { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },
  btn_primary: { backgroundColor: C.accent },
  btn_secondary: { backgroundColor: C.card2 },
  btn_ghost: { backgroundColor: 'transparent', minHeight: 48 },
  btn_danger: { backgroundColor: C.coralSoft },
  btnText: { fontSize: 16, fontFamily: F.bold, letterSpacing: -0.2 },
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
  chip: { flexBasis: '30%', flexGrow: 1, minWidth: 92, alignItems: 'center', paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20, borderWidth: 2, borderColor: 'transparent', backgroundColor: C.card, gap: 3 },
  chipOn: { borderColor: C.accent, backgroundColor: C.accentSoft },
  chipLabel: { fontSize: 14, fontFamily: F.bold, color: C.ink },
  chipSub: { fontSize: 11, color: C.muted, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  section: { fontSize: 20, fontFamily: F.heavy, color: C.ink, marginTop: 14, letterSpacing: -0.3 },
});
