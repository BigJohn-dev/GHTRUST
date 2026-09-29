import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { security } from '@/api/endpoints';
import { ApiError, messageFor } from '@/api/errors';
import { biometricName, checkBiometric } from '@/auth/lock';
import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { Logo } from '@/components/Logo';
import { PinPad } from '@/components/PinPad';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { pinReset } from '@/lib/flags';
import { greeting } from '@/lib/format';
import { useMe } from '@/lib/queries';
import { space } from '@/theme/tokens';

/** Back after time away: sign-in PIN, or Face ID / fingerprint if turned on for this phone. */
export default function Unlock() {
  const { firstName, biometric, unlocked, forget, signOut } = useSession();
  const me = useMe();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const prompted = useRef(false);
  // Accounts from before sign-in PINs existed: the phone's own lock opens the app once,
  // then they're asked to create a PIN straight away.
  const noPinYet = me.data?.login_pin_set === false;

  const tryBiometric = useCallback(async () => {
    if (!biometric) return;
    if (await checkBiometric('Unlock GH Trust')) unlocked();
  }, [biometric, unlocked]);

  useEffect(() => {
    if (biometric && !prompted.current) {
      prompted.current = true;
      tryBiometric();
    }
  }, [biometric, tryBiometric]);

  const submit = async (value: string) => {
    setBusy(true);
    try {
      await security.verifyPin(value);
      unlocked();
    } catch (err) {
      setPin('');
      setTries((n) => n + 1);
      if (err instanceof ApiError && err.code === 'PIN_ATTEMPTS_EXCEEDED') {
        // The server has signed this phone out and stopped trusting it.
        await forget();
        return;
      }
      setError(messageFor(err, "We couldn't check your PIN. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const forgotPin = async () => {
    // Prove it's you with an SMS code, then choose a new PIN.
    pinReset.start();
    await signOut();
  };

  if (noPinYet) {
    return (
      <Screen
        scroll={false}
        footer={
          <>
            <Button
              title="Continue"
              icon="lock-open-outline"
              onPress={async () => {
                if (Platform.OS === 'web') return unlocked();
                const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock GH Trust' });
                if (res.success || res.error === 'not_enrolled' || res.error === 'passcode_not_set') unlocked();
              }}
            />
            <Button title={firstName ? `Not ${firstName}? Sign out` : 'Sign out'} variant="ghost" onPress={() => forget()} />
          </>
        }>
        <View style={styles.center}>
          <Logo size={72} />
          <Text variant="title" align="center" style={{ marginTop: space.lg }}>
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </Text>
          <Text muted align="center">
            Unlock to continue. You'll then create a sign-in PIN to keep your account safe.
          </Text>
        </View>
      </Screen>
    );
  }

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
        sideKey={
          biometric
            ? {
                icon: biometric === 'face' ? 'scan-outline' : 'finger-print',
                label: `Unlock with ${biometricName(biometric)}`,
                onPress: tryBiometric,
              }
            : undefined
        }
      />

      <View style={styles.links}>
        <Button title="Forgot PIN?" variant="ghost" size="sm" onPress={forgotPin} />
        <Button title={firstName ? `Not ${firstName}?` : 'Sign out'} variant="ghost" size="sm" onPress={() => forget()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xs },
  head: { alignItems: 'center', gap: space.xs, marginTop: space.xl, marginBottom: space.lg },
  links: { flexDirection: 'row', justifyContent: 'center', gap: space.md, marginTop: space.md },
});
