/**
 * PIN entry: a row of dots over the app's own number pad (no system keyboard, so no
 * autocorrect, suggestions or keyboard logging). Shakes on a wrong PIN.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { colors, font, space } from '@/theme/tokens';

import { Text } from './Text';

type SideKey = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };

type Props = {
  value: string;
  onChange: (next: string) => void;
  length: 4 | 6;
  /** Called once when the last digit goes in. */
  onComplete?: (pin: string) => void;
  /** Wrong-PIN message, shown under the dots. */
  error?: string | null;
  /** Change this to shake the dots again (e.g. the same message twice in a row). */
  shakeKey?: number;
  disabled?: boolean;
  /** Bottom-left key, e.g. Face ID. */
  sideKey?: SideKey;
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function tap() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => undefined);
}

export function PinPad({ value, onChange, length, onComplete, error, shakeKey, disabled, sideKey }: Props) {
  const shake = useSharedValue(0);

  useEffect(() => {
    if (!error) return;
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-7, { duration: 50 }),
      withTiming(7, { duration: 50 }),
      withSpring(0, { damping: 12, stiffness: 400 }),
    );
  }, [error, shakeKey, shake]);

  const dotsStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const press = (digit: string) => {
    if (disabled || value.length >= length) return;
    tap();
    const next = value + digit;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };
  const back = () => {
    if (disabled || !value) return;
    tap();
    onChange(value.slice(0, -1));
  };

  return (
    <View style={styles.wrap}>
      <Animated.View
        style={[styles.dots, dotsStyle]}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${value.length} of ${length} digits entered`}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={[styles.dot, i < value.length && styles.dotFilled, !!error && value.length === 0 && styles.dotError]}
          />
        ))}
      </Animated.View>
      <View style={styles.message}>
        {error ? (
          <Text variant="small" color={colors.error} align="center" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </View>

      <View style={styles.grid}>
        {KEYS.map((k) => (
          <Key key={k} label={k} onPress={() => press(k)} disabled={disabled} />
        ))}
        {sideKey ? (
          <Key icon={sideKey.icon} accessibilityLabel={sideKey.label} onPress={sideKey.onPress} disabled={disabled} />
        ) : (
          <View style={styles.key} />
        )}
        <Key label="0" onPress={() => press('0')} disabled={disabled} />
        <Key icon="backspace-outline" accessibilityLabel="Delete" onPress={back} disabled={disabled || !value} quiet />
      </View>
    </View>
  );
}

function Key({
  label,
  icon,
  accessibilityLabel,
  onPress,
  disabled,
  quiet,
}: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  accessibilityLabel?: string;
  onPress: () => void;
  disabled?: boolean;
  quiet?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.key, !quiet && !icon && styles.keyDigit, pressed && styles.keyPressed]}>
      {icon ? (
        <Ionicons name={icon} size={26} color={disabled ? colors.textFaint : colors.navy} />
      ) : (
        <Text style={styles.keyLabel}>{label}</Text>
      )}
    </Pressable>
  );
}

const KEY = 72;

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  dots: { flexDirection: 'row', gap: 14, paddingVertical: space.xs },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.borderStrong,
  },
  dotFilled: { backgroundColor: colors.navy, borderColor: colors.navy },
  dotError: { borderColor: colors.error },
  message: { minHeight: 36, justifyContent: 'center', paddingHorizontal: space.lg },
  grid: {
    width: KEY * 3 + space.xl * 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: space.sm,
  },
  key: { width: KEY, height: KEY, borderRadius: KEY / 2, alignItems: 'center', justifyContent: 'center' },
  keyDigit: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  keyPressed: { backgroundColor: colors.surfaceNav, transform: [{ scale: 0.96 }] },
  keyLabel: { fontFamily: font.semibold, fontSize: 28, color: colors.navy },
});
