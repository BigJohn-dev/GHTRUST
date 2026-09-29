import { router } from 'expo-router';
import { useState } from 'react';
import { Switch } from 'react-native';

import { security } from '@/api/endpoints';
import { messageFor } from '@/api/errors';
import { biometricName } from '@/auth/lock';
import { useSession } from '@/auth/session';
import { Card, Row, SectionHeader } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Banner } from '@/components/States';
import { Text } from '@/components/Text';
import { dateTime } from '@/lib/format';
import { useMe } from '@/lib/queries';
import { colors, space } from '@/theme/tokens';

export default function Security() {
  const me = useMe();
  const { biometric, biometricAvailable, setBiometric } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());
  const p = me.data;
  const hold = p?.transfers_blocked_until ? new Date(p.transfers_blocked_until) : null;
  const onHold = hold && hold.getTime() > openedAt;

  const toggleBiometric = async (on: boolean) => {
    setError(null);
    if (on) return router.push('/pin/enable-biometric');
    try {
      await security.setBiometrics(false);
    } catch (err) {
      // Turning it off locally is what matters; the server flag only widens what a biometric can approve.
      setError(messageFor(err));
    }
    await setBiometric(false);
  };

  return (
    <Screen edges={['bottom']}>
      {onHold ? (
        <Banner
          tone="warning"
          message={`You signed in without your old phone, so money can't leave your account until ${dateTime(hold!.toISOString())}.`}
        />
      ) : null}
      {error ? <Banner message={error} /> : null}

      <SectionHeader title="Sign-in PIN" />
      <Card style={{ paddingVertical: space.xs }}>
        <Row
          icon="keypad-outline"
          title="Change sign-in PIN"
          subtitle="The 6 digits that open GH Trust"
          onPress={() => router.push('/pin/change-login')}
          last={!biometricAvailable}
        />
        {biometricAvailable ? (
          <Row
            icon={biometricAvailable === 'face' ? 'scan-outline' : 'finger-print'}
            title={`Unlock with ${biometricName(biometricAvailable)}`}
            subtitle="Instead of typing your PIN on this phone"
            trailing={
              <Switch
                value={!!biometric}
                onValueChange={toggleBiometric}
                trackColor={{ true: colors.navy, false: colors.borderStrong }}
                accessibilityLabel={`Unlock with ${biometricName(biometricAvailable)}`}
              />
            }
            last
          />
        ) : null}
      </Card>

      <SectionHeader title="Transaction PIN" />
      <Card style={{ paddingVertical: space.xs }}>
        {p?.transaction_pin_set ? (
          <>
            <Row
              icon="card-outline"
              title="Change transaction PIN"
              subtitle="The 4 digits that approve payments"
              onPress={() => router.push('/pin/change-transaction')}
            />
            <Row
              icon="help-circle-outline"
              title="Forgot transaction PIN"
              subtitle="Set a new one with your sign-in PIN"
              onPress={() => router.push('/pin/reset-transaction')}
              last
            />
          </>
        ) : (
          <Row
            icon="card-outline"
            title="Create transaction PIN"
            subtitle="Needed before money can leave your account"
            onPress={() => router.push('/pin/set-transaction')}
            last
          />
        )}
      </Card>

      <SectionHeader title="Phones" />
      <Card style={{ paddingVertical: space.xs }}>
        <Row
          icon="phone-portrait-outline"
          title="Signed-in devices"
          subtitle="See and remove phones"
          onPress={() => router.push('/devices')}
          last
        />
      </Card>
      <Text variant="small" muted style={{ paddingHorizontal: space.xs }}>
        Signing in on a new phone needs your approval on a phone that's already signed in.
      </Text>
    </Screen>
  );
}
