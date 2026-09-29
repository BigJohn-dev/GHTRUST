/**
 * A sequence of PIN pads: e.g. "current PIN → new PIN → confirm". Checks confirmation
 * and obvious weak PINs on the phone, then hands every value to `onDone`. If that fails
 * the flow restarts at the step `restartAt` picks (default: the first step).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { ApiError, messageFor } from '@/api/errors';
import { weakPinReason } from '@/lib/pin';
import { space } from '@/theme/tokens';

import { PinPad } from './PinPad';
import { Text } from './Text';

export type PinStep = {
  key: string;
  title: string;
  subtitle?: string;
  length: 4 | 6;
  /** Must equal the value entered at this earlier step. */
  confirms?: string;
  /** A new PIN being chosen: reject obvious ones before asking to confirm. */
  isNew?: boolean;
  /** Extra on-phone rule for this step: a message if the PIN isn't acceptable. */
  validate?: (pin: string) => string | null;
};

type Props = {
  steps: PinStep[];
  onDone: (values: Record<string, string>) => Promise<void>;
  /** Which step to go back to after `onDone` fails (by step key). */
  restartAt?: (error: unknown) => string | undefined;
  sideKey?: Parameters<typeof PinPad>[0]['sideKey'];
};

export function PinFlow({ steps, onDone, restartAt, sideKey }: Props) {
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const step = steps[index];

  const goTo = (key: string | undefined, message: string) => {
    const at = Math.max(0, steps.findIndex((s) => s.key === key));
    setIndex(at);
    setValue('');
    setAttempt((n) => n + 1);
    setError(message);
  };

  const complete = async (pin: string) => {
    if (step.isNew) {
      const weak = weakPinReason(pin) ?? step.validate?.(pin) ?? null;
      if (weak) return goTo(step.key, weak);
    }
    if (step.confirms && values[step.confirms] !== pin) {
      return goTo(step.confirms, "Those PINs didn't match. Try again.");
    }
    const next = { ...values, [step.key]: pin };
    setValues(next);
    if (index < steps.length - 1) {
      setIndex(index + 1);
      setValue('');
      setError(null);
      return;
    }
    setBusy(true);
    try {
      await onDone(next);
    } catch (err) {
      const firstNew = steps.find((s) => s.isNew)?.key;
      const fallback = err instanceof ApiError && err.code === 'PIN_TOO_WEAK' ? firstNew : steps[0].key;
      goTo(restartAt?.(err) ?? fallback, messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Animated.View key={`${step.key}-${attempt}`} entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={styles.head}>
        <Text variant="title" align="center">
          {step.title}
        </Text>
        {step.subtitle ? (
          <Text muted align="center">
            {step.subtitle}
          </Text>
        ) : null}
      </Animated.View>
      <PinPad
        length={step.length}
        value={value}
        onChange={(v) => {
          setValue(v);
          if (error && v) setError(null);
        }}
        onComplete={complete}
        error={error}
        shakeKey={attempt}
        disabled={busy}
        sideKey={index === 0 ? sideKey : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: space.xl },
  head: { gap: space.xs, paddingHorizontal: space.lg },
});
