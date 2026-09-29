/**
 * Illustrations for the first-launch intro, built from views so they stay crisp at any
 * size and animate on the UI thread. Each one loops gently while its slide is on screen.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/Text';
import { colors, radius, shadow, space } from '@/theme/tokens';

type ArtProps = { active: boolean };

/** A 0→1→0 loop that runs only while `active` (and not at all with reduced motion). */
function useLoop(active: boolean, duration: number, delay = 0) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!active || reduced) {
      cancelAnimation(t);
      return;
    }
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(t);
  }, [active, reduced, duration, delay, t]);
  return t;
}

/** A 0→1 sweep that restarts every `duration` ms while `active`. */
function useCycle(active: boolean, duration: number) {
  const reduced = useReducedMotion();
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) {
      t.value = 1;
      return;
    }
    if (!active) {
      cancelAnimation(t);
      t.value = 0;
      return;
    }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [active, reduced, duration, t]);
  return t;
}

// ─── 1. Loans that fit your life ───────────────────────────────────────────────

const CHIPS: { icon: keyof typeof Ionicons.glyphMap; label: string; pos: object; delay: number }[] = [
  { icon: 'briefcase', label: 'Business', pos: { top: 6, left: 0 }, delay: 0 },
  { icon: 'school', label: 'Study', pos: { top: 36, right: -4 }, delay: 500 },
  { icon: 'car-sport', label: 'Asset', pos: { bottom: 26, left: -8 }, delay: 900 },
  { icon: 'calendar', label: 'Payday', pos: { bottom: 0, right: 8 }, delay: 300 },
];

export function LoansArt({ active }: ArtProps) {
  const fill = useCycle(active, 3600);
  const float = useLoop(active, 2600);

  const card = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [-4, 4]) }, { rotate: '-4deg' }],
  }));
  const bar = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(fill.value, [0, 0.55, 1], [0.08, 0.72, 0.72], 'clamp') }],
  }));
  const approved = useAnimatedStyle(() => {
    const t = interpolate(fill.value, [0.55, 0.65, 0.92, 1], [0, 1, 1, 0], 'clamp');
    return { opacity: t, transform: [{ scale: 0.7 + t * 0.3 }] };
  });

  return (
    <View style={art.box}>
      <View style={art.halo} />
      <Animated.View style={[art.loanCard, shadow, card]}>
        <Text variant="caption" color={colors.textFaint}>
          LOAN OFFER
        </Text>
        <Text variant="title" style={{ marginTop: 2 }}>
          ₦500,000
        </Text>
        <Text variant="small" muted>
          12 months · 2.5% monthly
        </Text>
        <View style={art.track}>
          <Animated.View style={[art.fill, bar]} />
        </View>
        <Animated.View style={[art.approved, approved]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.success} />
          <Text variant="small" color={colors.success} style={{ fontFamily: 'Montserrat_700Bold' }}>
            Approved
          </Text>
        </Animated.View>
      </Animated.View>
      {CHIPS.map((c) => (
        <FloatingChip key={c.label} {...c} active={active} />
      ))}
    </View>
  );
}

function FloatingChip({ icon, label, pos, delay, active }: (typeof CHIPS)[number] & ArtProps) {
  const t = useLoop(active, 2200 + delay, delay);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(t.value, [0, 1], [6, -6]) }] }));
  return (
    <Animated.View style={[art.chip, shadow, pos, style]}>
      <View style={art.chipIcon}>
        <Ionicons name={icon} size={13} color={colors.white} />
      </View>
      <Text variant="small" style={{ fontFamily: 'Montserrat_700Bold' }}>
        {label}
      </Text>
    </Animated.View>
  );
}

// ─── 2. Know where you stand ───────────────────────────────────────────────────

const STEPS = ['Application sent', 'Under review', 'Approved', 'Paid to your account'];

export function TrackArt({ active }: ArtProps) {
  const t = useCycle(active, 5200);
  const float = useLoop(active, 3000);
  const card = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.value, [0, 1], [-3, 3]) }] }));
  const line = useAnimatedStyle(() => ({
    transform: [{ scaleY: interpolate(t.value, [0.05, 0.7], [0, 1], 'clamp') }],
  }));

  return (
    <View style={art.box}>
      <View style={art.halo} />
      <Animated.View style={[art.trackCard, shadow, card]}>
        <View style={art.trackHead}>
          <Text variant="heading">Business loan</Text>
          <Text variant="small" muted>
            ₦750,000
          </Text>
        </View>
        <View>
          <View style={art.rail} />
          <Animated.View style={[art.railFill, line]} />
          {STEPS.map((label, i) => (
            <Step key={label} label={label} at={0.05 + i * (0.65 / (STEPS.length - 1))} progress={t} />
          ))}
        </View>
      </Animated.View>
    </View>
  );
}

function Step({ label, at, progress }: { label: string; at: number; progress: SharedValue<number> }) {
  const node = useAnimatedStyle(() => {
    const on = interpolate(progress.value, [at - 0.02, at + 0.04], [0, 1], 'clamp');
    return { transform: [{ scale: 0.6 + on * 0.4 }], opacity: 0.25 + on * 0.75 };
  });
  const text = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [at - 0.02, at + 0.06], [0.35, 1], 'clamp'),
  }));
  return (
    <View style={art.step}>
      <View style={art.nodeSlot}>
        <View style={art.nodeIdle} />
        <Animated.View style={[art.node, node]}>
          <Ionicons name="checkmark" size={12} color={colors.white} />
        </Animated.View>
      </View>
      <Animated.View style={text}>
        <Text variant="bodyStrong">{label}</Text>
      </Animated.View>
    </View>
  );
}

// ─── 3. Safe with you ──────────────────────────────────────────────────────────

const BADGES: { icon: keyof typeof Ionicons.glyphMap; label: string; pos: object; delay: number }[] = [
  { icon: 'finger-print', label: 'Biometric lock', pos: { top: 18, left: -6 }, delay: 200 },
  { icon: 'id-card', label: 'BVN verified', pos: { top: 70, right: -10 }, delay: 700 },
  { icon: 'lock-closed', label: 'Encrypted', pos: { bottom: 14, left: 14 }, delay: 1100 },
];

export function SecureArt({ active }: ArtProps) {
  const pulse = useCycle(active, 2400);
  const float = useLoop(active, 2800);

  const shield = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [-5, 5]) }],
  }));

  return (
    <View style={art.box}>
      <View style={art.halo} />
      <Pulse progress={pulse} from={0} />
      <Pulse progress={pulse} from={0.5} />
      <Animated.View style={[art.shield, shield]}>
        <Ionicons name="shield-checkmark" size={72} color={colors.white} />
      </Animated.View>
      {BADGES.map((b) => (
        <FloatingBadge key={b.label} {...b} active={active} />
      ))}
    </View>
  );
}

function Pulse({ progress, from }: { progress: SharedValue<number>; from: number }) {
  const style = useAnimatedStyle(() => {
    const t = (progress.value + from) % 1;
    return { opacity: interpolate(t, [0, 0.2, 1], [0, 0.5, 0]), transform: [{ scale: 1 + t * 0.9 }] };
  });
  return <Animated.View style={[art.pulse, style]} />;
}

function FloatingBadge({ icon, label, pos, delay, active }: (typeof BADGES)[number] & ArtProps) {
  const t = useLoop(active, 2400 + delay / 2, delay);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(t.value, [0, 1], [5, -5]) }] }));
  return (
    <Animated.View style={[art.chip, shadow, pos, style]}>
      <View style={[art.chipIcon, { backgroundColor: colors.success }]}>
        <Ionicons name={icon} size={13} color={colors.white} />
      </View>
      <Text variant="small" style={{ fontFamily: 'Montserrat_700Bold' }}>
        {label}
      </Text>
    </Animated.View>
  );
}

const art = StyleSheet.create({
  box: { width: 280, height: 260, alignItems: 'center', justifyContent: 'center' },
  halo: {
    position: 'absolute',
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(47,164,215,0.14)',
  },
  loanCard: {
    width: 210,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    gap: 2,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceNav,
    marginTop: space.md,
    overflow: 'hidden',
  },
  fill: { flex: 1, borderRadius: 4, backgroundColor: colors.cyan, transformOrigin: 'left' },
  approved: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.card,
  },
  chipIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackCard: { width: 236, padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.card },
  trackHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.md },
  rail: { position: 'absolute', left: 10, top: 12, bottom: 12, width: 2, backgroundColor: colors.border },
  railFill: {
    position: 'absolute',
    left: 10,
    top: 12,
    bottom: 12,
    width: 2,
    backgroundColor: colors.success,
    transformOrigin: 'top',
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm, height: 36 },
  nodeSlot: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  nodeIdle: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: colors.border },
  node: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shield: {
    width: 128,
    height: 128,
    borderRadius: 40,
    backgroundColor: colors.cyan,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: colors.cyan,
  },
});
