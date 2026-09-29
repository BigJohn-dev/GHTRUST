import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { approvals } from '@/api/endpoints';
import { ApiError, messageFor } from '@/api/errors';
import { deviceInfo } from '@/auth/device';
import { pendingApproval } from '@/auth/pending';
import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Field } from '@/components/Field';
import { PinPad } from '@/components/PinPad';
import { Screen } from '@/components/Screen';
import { Banner } from '@/components/States';
import { Text } from '@/components/Text';
import { digits } from '@/lib/format';
import { colors, space } from '@/theme/tokens';

const CONSEQUENCES: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'log-out-outline', text: 'Every other phone is signed out, including your old one.' },
  { icon: 'time-outline', text: "Money can't leave your account for 24 hours. You can still see everything and receive money." },
];

/** No access to the signed-in phone: BVN and sign-in PIN instead, with safeguards. */
export default function LostPhone() {
  const { signIn } = useSession();
  const pending = pendingApproval.get();
  const [bvn, setBvn] = useState('');
  const [step, setStep] = useState<'bvn' | 'pin'>('bvn');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pending) router.replace('/sign-in');
  }, [pending]);
  if (!pending) return null;

  const submit = async (pinValue?: string) => {
    setBusy(true);
    setError(null);
    try {
      const tokens = await approvals.lostPhone(pending.id, pending.secret, bvn, pinValue, await deviceInfo());
      pendingApproval.clear();
      await signIn(tokens);
    } catch (err) {
      setPin('');
      setTries((n) => n + 1);
      if (err instanceof ApiError && err.code === 'APPROVAL_NOT_ACTIVE') {
        pendingApproval.clear();
        router.replace('/sign-in');
        return;
      }
      if (err instanceof ApiError && err.code === 'BVN_MISMATCH') setStep('bvn');
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  };

  if (step === 'pin') {
    return (
      <Screen edges={['bottom']} scroll={false}>
        <View style={styles.head}>
          <Text variant="title" align="center">
            Enter your sign-in PIN
          </Text>
          <Text muted align="center">
            The 6-digit PIN you use to open GH Trust.
          </Text>
        </View>
        <PinPad
          length={6}
          value={pin}
          onChange={(v) => {
            setPin(v);
            if (error && v) setError(null);
          }}
          onComplete={(v) => submit(v)}
          error={error}
          shakeKey={tries}
          disabled={busy}
        />
      </Screen>
    );
  }

  const bvnOk = /^\d{11}$/.test(bvn);
  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title={pending.fallbackNeedsPin ? 'Continue' : 'Sign in'}
          disabled={!bvnOk}
          loading={busy}
          onPress={() => (pending.fallbackNeedsPin ? setStep('pin') : submit())}
        />
      }>
      <Text variant="title">Sign in without your other phone</Text>
      <Text muted>Lost it, or can't reach it? Confirm it's you with your BVN and sign-in PIN.</Text>

      <Card style={styles.warn}>
        <Text variant="bodyStrong">For your security</Text>
        {CONSEQUENCES.map((c) => (
          <View key={c.icon} style={styles.row}>
            <Ionicons name={c.icon} size={18} color={colors.warning} />
            <Text variant="small" style={{ flex: 1 }}>
              {c.text}
            </Text>
          </View>
        ))}
      </Card>

      {error ? <Banner message={error} /> : null}

      <Field
        label="BVN"
        value={bvn}
        onChangeText={(t) => setBvn(digits(t).slice(0, 11))}
        keyboardType="number-pad"
        placeholder="11 digits"
        maxLength={11}
        secureTextEntry
        autoFocus
        hint="Dial *565*0# on the phone number linked to your BVN if you don't know it."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: space.xs, marginTop: space.xl, marginBottom: space.lg },
  warn: { gap: space.sm, backgroundColor: colors.warningBg, borderColor: 'transparent' },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
});
