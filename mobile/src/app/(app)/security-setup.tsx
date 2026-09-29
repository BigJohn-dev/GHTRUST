import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { security } from '@/api/endpoints';
import { messageFor } from '@/api/errors';
import type { Profile } from '@/api/types';
import { biometricName, checkBiometric } from '@/auth/lock';
import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { Field } from '@/components/Field';
import { PinFlow } from '@/components/PinFlow';
import { Screen } from '@/components/Screen';
import { Banner } from '@/components/States';
import { Text } from '@/components/Text';
import { pinReset, setupFlow, usePinReset } from '@/lib/flags';
import { digits } from '@/lib/format';
import { keys, useMe } from '@/lib/queries';
import { colors, radius, space } from '@/theme/tokens';

type Step = 'bvn' | 'login' | 'offerTransaction' | 'transaction' | 'offerBiometric' | 'done';

/**
 * Right after signing in without a sign-in PIN (new account, or "Forgot PIN?"):
 *   1. sign-in PIN (required)
 *   2. transaction PIN (now or later: it's asked for before money first moves anyway)
 *   3. Face ID / fingerprint (now or later), if the phone has it
 */
export default function SecuritySetup() {
  const queryClient = useQueryClient();
  const me = useMe();
  const { biometric, biometricAvailable, setBiometric } = useSession();
  const resetting = usePinReset();
  const [step, setStep] = useState<Step>(resetting ? 'bvn' : 'login');
  const [bvn, setBvn] = useState('');
  const [bioError, setBioError] = useState<string | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  // Held only for this screen, to turn on biometrics without asking for it again.
  const loginPin = useRef('');

  const saveProfile = (profile: Profile) => queryClient.setQueryData(keys.me, profile);

  const afterLogin = () => {
    if (!me.data?.transaction_pin_set) return setStep('offerTransaction');
    afterTransaction();
  };
  const afterTransaction = () => {
    if (biometricAvailable && !biometric) return setStep('offerBiometric');
    finish();
  };
  const finish = () => {
    loginPin.current = '';
    pinReset.finish();
    setupFlow.finish(); // the guard now shows the app
  };

  const turnOnBiometric = async () => {
    if (!biometricAvailable) return finish();
    setBioBusy(true);
    setBioError(null);
    try {
      if (!(await checkBiometric(`Turn on ${biometricName(biometricAvailable)} for GH Trust`))) return;
      await security.setBiometrics(true, loginPin.current);
      await setBiometric(true);
      finish();
    } catch (err) {
      setBioError(messageFor(err));
    } finally {
      setBioBusy(false);
    }
  };

  if (step === 'bvn') {
    const ok = /^\d{11}$/.test(bvn);
    return (
      <Screen footer={<Button title="Continue" disabled={!ok} onPress={() => setStep('login')} />}>
        <Header icon="key-outline" title="Reset your sign-in PIN" />
        <Text muted>To make sure it's you, enter the BVN linked to your GH Trust account.</Text>
        <Field
          label="BVN"
          value={bvn}
          onChangeText={(t) => setBvn(digits(t).slice(0, 11))}
          keyboardType="number-pad"
          placeholder="11 digits"
          secureTextEntry
          autoFocus
        />
      </Screen>
    );
  }

  if (step === 'login') {
    return (
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <PinFlow
          steps={[
            {
              key: 'pin',
              title: resetting ? 'Choose a new sign-in PIN' : 'Create your sign-in PIN',
              subtitle: "6 digits you'll use to open GH Trust. Keep it to yourself.",
              length: 6,
              isNew: true,
            },
            { key: 'confirm', title: 'Enter it again', subtitle: 'Just to be sure.', length: 6, confirms: 'pin' },
          ]}
          restartAt={() => 'pin'}
          onDone={async ({ pin }) => {
            const profile = resetting ? await security.resetPin(bvn, pin) : await security.setPin(pin);
            saveProfile(profile);
            loginPin.current = pin;
            afterLogin();
          }}
        />
      </SafeAreaView>
    );
  }

  if (step === 'offerTransaction') {
    return (
      <Offer
        icon="card-outline"
        title="Create your transaction PIN"
        body="A separate 4-digit PIN that approves money leaving your account, like loan repayments. It's different from your sign-in PIN."
        primary={{ title: 'Create transaction PIN', onPress: () => setStep('transaction') }}
        secondary={{ title: "I'll do it later", onPress: afterTransaction }}
        note="If you skip this, we'll ask you to create it the first time you move money."
      />
    );
  }

  if (step === 'transaction') {
    return (
      <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
        <PinFlow
          steps={[
            {
              key: 'pin',
              title: 'Create your transaction PIN',
              subtitle: '4 digits to approve payments. Make it different from your sign-in PIN.',
              length: 4,
              isNew: true,
              validate: (pin) =>
                loginPin.current.includes(pin) ? "Don't reuse part of your sign-in PIN." : null,
            },
            { key: 'confirm', title: 'Enter it again', length: 4, confirms: 'pin' },
          ]}
          restartAt={() => 'pin'}
          onDone={async ({ pin }) => {
            saveProfile(await security.setTransactionPin(pin));
            afterTransaction();
          }}
        />
      </SafeAreaView>
    );
  }

  if (step === 'offerBiometric' && biometricAvailable) {
    const name = biometricName(biometricAvailable);
    return (
      <Offer
        icon={biometricAvailable === 'face' ? 'scan-outline' : 'finger-print'}
        title={`Unlock with ${name}?`}
        body={`Open GH Trust and approve new phones with ${name} instead of typing your PIN. Your PIN always works too.`}
        primary={{ title: `Turn on ${name}`, onPress: turnOnBiometric, loading: bioBusy }}
        secondary={{ title: 'Not now', onPress: finish }}
        note="You can change this any time in Profile → Security."
        error={bioError}
      />
    );
  }

  return null;
}

function Header({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.header}>
      <View style={styles.icon}>
        <Ionicons name={icon} size={30} color={colors.cyanDeep} />
      </View>
      <Text variant="title">{title}</Text>
    </View>
  );
}

function Offer({
  icon,
  title,
  body,
  primary,
  secondary,
  note,
  error,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  primary: { title: string; onPress: () => void; loading?: boolean };
  secondary: { title: string; onPress: () => void };
  note?: string;
  error?: string | null;
}) {
  return (
    <Screen
      scroll={false}
      footer={
        <>
          <Button title={primary.title} onPress={primary.onPress} loading={primary.loading} />
          <Button title={secondary.title} variant="ghost" onPress={secondary.onPress} />
        </>
      }>
      <Animated.View entering={FadeInDown.duration(350)} style={styles.offer}>
        <View style={styles.bigIcon}>
          <Ionicons name={icon} size={44} color={colors.white} />
        </View>
        <Text variant="title" align="center">
          {title}
        </Text>
        <Text muted align="center">
          {body}
        </Text>
        {note ? (
          <Text variant="small" muted align="center">
            {note}
          </Text>
        ) : null}
        {error ? <Banner message={error} /> : null}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: space.xl },
  header: { gap: space.md, marginTop: space.lg },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.sm },
  bigIcon: {
    width: 96,
    height: 96,
    borderRadius: 32,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
});
