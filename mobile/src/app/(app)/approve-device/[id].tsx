import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { approvals } from '@/api/endpoints';
import { ApiError, messageFor } from '@/api/errors';
import type { ApproveResult, PendingApproval } from '@/api/types';
import { biometricName, checkBiometric } from '@/auth/lock';
import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { PinPad } from '@/components/PinPad';
import { Banner, ProgressBar } from '@/components/States';
import { Text } from '@/components/Text';
import { colors, font, radius, space } from '@/theme/tokens';

type Stage = 'ask' | 'pin' | 'code' | 'denied' | 'gone';

/**
 * Someone is signing in to this account on another phone. The customer confirms it's
 * them (then proves it with their PIN or biometrics), and gets a code to type there.
 */
export default function ApproveDevice() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { biometric } = useSession();
  const request = queryClient.getQueryData<PendingApproval[]>(['approvals'])?.find((a) => a.id === id);
  const [stage, setStage] = useState<Stage>(request ? 'ask' : 'gone');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ code: ApproveResult; until: number } | null>(null);
  const device = request?.device_name || 'another phone';

  const close = () => {
    queryClient.invalidateQueries({ queryKey: ['approvals'] });
    router.back();
  };

  const approve = async (proof: { pin?: string; biometric?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await approvals.approve(id, proof);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setResult({ code: res, until: Date.now() + res.expires_in * 1000 });
      setStage('code');
    } catch (err) {
      setPin('');
      setTries((n) => n + 1);
      if (err instanceof ApiError && ['APPROVAL_NOT_ACTIVE', 'APPROVAL_NOT_FOUND'].includes(err.code)) {
        setStage('gone');
      } else if (err instanceof ApiError && err.code === 'REAUTH_REQUIRED') {
        setStage('pin'); // biometrics aren't set up on the server for this sign-in: use the PIN
      } else {
        setError(messageFor(err));
      }
    } finally {
      setBusy(false);
    }
  };

  const confirmItsMe = async () => {
    if (biometric && (await checkBiometric(`Approve sign-in on ${device}`))) {
      return approve({ biometric: true });
    }
    setStage('pin');
  };

  const deny = async () => {
    setBusy(true);
    try {
      await approvals.deny(id);
    } catch {
      // Already expired or handled elsewhere: the outcome is the same for the customer.
    } finally {
      setBusy(false);
      setStage('denied');
    }
  };

  if (stage === 'gone') {
    return (
      <Shell footer={<Button title="Close" onPress={close} />}>
        <Hero icon="time-outline" tone="muted" />
        <Text variant="title" align="center">
          This request has ended
        </Text>
        <Text muted align="center">
          The sign-in was already approved, declined or it expired.
        </Text>
      </Shell>
    );
  }

  if (stage === 'denied') {
    return (
      <Shell footer={<Button title="Done" onPress={close} />}>
        <Hero icon="shield-checkmark" tone="success" />
        <Text variant="title" align="center">
          Sign-in blocked
        </Text>
        <Text muted align="center">
          That phone can't get into your account. Whoever tried had a code sent to your phone number, so:
        </Text>
        <Card style={styles.advice}>
          <Advice text="Never share codes from GH Trust with anyone, even staff." />
          <Advice text="If you've lost access to your SIM, contact your network and GH Trust." />
          <Advice text="Change your sign-in PIN in Profile → Security if you think someone knows it." last />
        </Card>
      </Shell>
    );
  }

  if (stage === 'code' && result) {
    return (
      <Shell footer={<Button title="Done" onPress={close} />}>
        <CodeCard code={result.code.code} until={result.until} total={result.code.expires_in} device={device} />
      </Shell>
    );
  }

  if (stage === 'pin') {
    return (
      <Shell
        footer={<Button title="Cancel" variant="ghost" onPress={() => setStage('ask')} />}
        center={false}>
        <View style={styles.pinHead}>
          <Text variant="title" align="center">
            Confirm it's you
          </Text>
          <Text muted align="center">
            Enter your 6-digit sign-in PIN to approve {device}.
          </Text>
        </View>
        <PinPad
          length={6}
          value={pin}
          onChange={(v) => {
            setPin(v);
            if (error && v) setError(null);
          }}
          onComplete={(v) => approve({ pin: v })}
          error={error}
          shakeKey={tries}
          disabled={busy}
          sideKey={
            biometric
              ? {
                  icon: biometric === 'face' ? 'scan-outline' : 'finger-print',
                  label: `Use ${biometricName(biometric)}`,
                  onPress: confirmItsMe,
                }
              : undefined
          }
        />
      </Shell>
    );
  }

  const when = request ? new Date(request.requested_at) : null;
  return (
    <Shell
      footer={
        <>
          <Button title="Yes, it's me" icon="checkmark" loading={busy} onPress={confirmItsMe} />
          <Button title="No, it wasn't me" variant="danger" onPress={deny} disabled={busy} />
        </>
      }>
      <Hero icon="phone-portrait-outline" tone="brand" />
      <Text variant="title" align="center">
        Is this you signing in?
      </Text>
      <Text muted align="center">
        Someone is signing in to your GH Trust account on a new phone.
      </Text>
      <Card style={styles.details}>
        <Detail
          icon={request?.platform === 'ios' ? 'logo-apple' : request?.platform === 'android' ? 'logo-android' : 'phone-portrait-outline'}
          label="Phone"
          value={device}
        />
        {when ? (
          <Detail
            icon="time-outline"
            label="When"
            value={when.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
          />
        ) : null}
        {request?.ip_address ? <Detail icon="globe-outline" label="Network address" value={request.ip_address} last /> : null}
      </Card>
      {error ? <Banner message={error} /> : null}
      <Text variant="small" muted align="center">
        Only approve if you're holding that phone right now. GH Trust will never call or message you to ask for
        this.
      </Text>
    </Shell>
  );
}

function CodeCard({ code, until, total, device }: { code: string; until: number; total: number; device: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Math.round((until - now) / 1000));
  return (
    <Animated.View entering={FadeIn.duration(300)} style={{ alignItems: 'center', gap: space.md, width: '100%' }}>
      <Hero icon="checkmark" tone="success" />
      <Text variant="title" align="center">
        Enter this code on {device}
      </Text>
      <Animated.View entering={ZoomIn.springify().delay(150)} style={styles.code}>
        <Text
          style={styles.codeText}
          accessibilityLabel={`Code ${code.split('').join(' ')}`}
          selectable={false}>
          {code.slice(0, 3)} {code.slice(3)}
        </Text>
      </Animated.View>
      <View style={{ width: '100%', gap: space.xs }}>
        <ProgressBar value={left / total} color={left < 60 ? colors.warningRaw : colors.cyan} />
        <Text variant="small" muted align="center">
          {left > 0 ? `Expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : 'This code has expired.'}
        </Text>
      </View>
      <Text variant="small" muted align="center">
        Don't read this code to anyone. Only type it on the phone you're signing in on.
      </Text>
    </Animated.View>
  );
}

function Shell({ children, footer, center = true }: { children: React.ReactNode; footer: React.ReactNode; center?: boolean }) {
  return (
    <SafeAreaView style={styles.fill} edges={['top', 'bottom']}>
      <View style={[styles.body, center && styles.center]}>{children}</View>
      <View style={styles.footer}>{footer}</View>
    </SafeAreaView>
  );
}

function Hero({ icon, tone }: { icon: keyof typeof Ionicons.glyphMap; tone: 'brand' | 'success' | 'muted' }) {
  const bg = { brand: colors.navy, success: colors.success, muted: colors.textFaint }[tone];
  return (
    <Animated.View entering={ZoomIn.springify()} style={[styles.hero, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={40} color={colors.white} />
    </Animated.View>
  );
}

function Detail({ icon, label, value, last }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.detail, !last && styles.divider]}>
      <Ionicons name={icon} size={18} color={colors.cyanDeep} />
      <Text variant="small" muted style={{ width: 120 }}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={{ flex: 1, textAlign: 'right' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Advice({ text, last }: { text: string; last?: boolean }) {
  return (
    <View style={[styles.detail, !last && styles.divider]}>
      <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
      <Text variant="small" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1, paddingHorizontal: space.xl, gap: space.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: space.xl, paddingBottom: space.md, gap: space.sm },
  hero: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  details: { width: '100%', paddingVertical: space.xs },
  advice: { width: '100%', paddingVertical: space.xs },
  detail: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  pinHead: { gap: space.xs, marginTop: space.xxl, marginBottom: space.lg },
  code: {
    paddingVertical: space.lg,
    paddingHorizontal: space.xxl,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  codeText: { fontFamily: font.extrabold, fontSize: 44, letterSpacing: 6, color: colors.navy, fontVariant: ['tabular-nums'] },
});
