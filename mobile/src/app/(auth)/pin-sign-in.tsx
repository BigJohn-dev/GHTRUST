import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { auth } from '@/api/endpoints';
import { ApiError, messageFor } from '@/api/errors';
import { deviceInfo } from '@/auth/device';
import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { PinPad } from '@/components/PinPad';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { pinReset } from '@/lib/flags';
import { greeting } from '@/lib/format';
import { space } from '@/theme/tokens';

/** Signed out on a phone that signed in before: the sign-in PIN replaces the SMS code. */
export default function PinSignIn() {
  const { firstName, signIn, forget } = useSession();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);

  const submit = async (value: string) => {
    setBusy(true);
    try {
      await signIn(await auth.pinSignIn(await deviceInfo(), value));
    } catch (err) {
      setPin('');
      setTries((n) => n + 1);
      if (err instanceof ApiError && ['DEVICE_NOT_TRUSTED', 'PIN_ATTEMPTS_EXCEEDED'].includes(err.code)) {
        // This phone is no longer trusted: an SMS code is the only way in now.
        await forget();
        router.replace('/sign-in');
        return;
      }
      setError(messageFor(err, "We couldn't sign you in. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={false}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.head}>
        <Logo size={56} />
        <Text variant="title" align="center" style={{ marginTop: space.md }}>
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </Text>
        <Text muted align="center">
          Enter your 6-digit sign-in PIN
        </Text>
      </Animated.View>

      <PinPad
        length={6}
        value={pin}
        onChange={(v) => {
          setPin(v);
          if (error && v) setError(null);
        }}
        onComplete={submit}
        error={error}
        shakeKey={tries}
        disabled={busy}
      />

      <View style={styles.links}>
        <Button
          title="Forgot PIN?"
          variant="ghost"
          size="sm"
          onPress={() => {
            pinReset.start();
            router.push('/sign-in');
          }}
        />
        <Button title="Switch account" variant="ghost" size="sm" onPress={() => forget()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: space.xs, marginTop: space.xl, marginBottom: space.lg },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.md, marginTop: space.md },
});
