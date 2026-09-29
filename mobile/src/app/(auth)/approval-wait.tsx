import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { approvals } from '@/api/endpoints';
import { ApiError, messageFor } from '@/api/errors';
import { deviceInfo } from '@/auth/device';
import { pendingApproval } from '@/auth/pending';
import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { OtpInput } from '@/components/OtpInput';
import { Screen } from '@/components/Screen';
import { Banner } from '@/components/States';
import { Text } from '@/components/Text';
import { colors, radius, space } from '@/theme/tokens';

const ENDED = { denied: 'This sign-in was declined on your other phone.', expired: 'This sign-in request expired.', failed: 'Too many wrong codes.' };

/**
 * New phone, while another is signed in: wait for "Yes, it's me" there, then type the
 * 6-digit code that phone shows.
 */
export default function ApprovalWait() {
  const { signIn } = useSession();
  const pending = pendingApproval.get();
  const [code, setCode] = useState('');
  const submitted = useRef('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) router.replace('/sign-in');
  }, [pending]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const status = useQuery({
    queryKey: ['approval', pending?.id],
    queryFn: () => approvals.status(pending!.id, pending!.secret),
    enabled: !!pending,
    refetchInterval: (q) => (['pending', 'approved'].includes(q.state.data?.status ?? 'pending') ? 3000 : false),
    retry: 1,
  });

  const complete = useMutation({
    mutationFn: async (value: string) => approvals.complete(pending!.id, pending!.secret, value, await deviceInfo()),
    onSuccess: async (tokens) => {
      pendingApproval.clear();
      await signIn(tokens);
    },
  });

  useEffect(() => {
    if (code.length === 6 && submitted.current !== code && !complete.isPending) {
      submitted.current = code;
      complete.mutate(code);
    }
  }, [code, complete]);

  if (!pending) return null;

  const state = status.data?.status ?? 'pending';
  const ended =
    (complete.error instanceof ApiError && complete.error.code === 'APPROVAL_NOT_ACTIVE') ||
    ['denied', 'expired', 'failed'].includes(state);
  const secondsLeft = Math.max(0, Math.round((pending.expiresAt - now) / 1000));
  const phones = pending.approverDevices.join(' or ');

  if (ended) {
    const reason = ENDED[state as keyof typeof ENDED] ?? messageFor(complete.error);
    return (
      <Screen
        edges={['bottom']}
        scroll={false}
        footer={
          <Button
            title="Start again"
            onPress={() => {
              pendingApproval.clear();
              router.replace('/sign-in');
            }}
          />
        }>
        <View style={styles.center}>
          <View style={[styles.badge, { backgroundColor: colors.errorBg }]}>
            <Ionicons name="close" size={34} color={colors.error} />
          </View>
          <Text variant="title" align="center">
            Sign-in stopped
          </Text>
          <Text muted align="center">
            {reason}
            {state === 'denied' ? ' If that was you, sign in again and choose "Yes, it\'s me" on your other phone.' : ''}
          </Text>
        </View>
      </Screen>
    );
  }

  const approved = state === 'approved';

  return (
    <Screen
      edges={['bottom']}
      footer={
        <Button
          title="I don't have my other phone"
          variant="ghost"
          onPress={() => router.push('/lost-phone')}
        />
      }>
      <Animated.View entering={FadeIn.duration(350)} style={styles.hero}>
        <Handshake approved={approved} />
      </Animated.View>

      {approved ? (
        <Animated.View entering={FadeInDown.duration(350)} style={{ gap: space.md }}>
          <Text variant="title">Enter the code</Text>
          <Text muted>Type the 6-digit code now showing on your {phones}.</Text>
          {complete.error ? <Banner message={messageFor(complete.error)} /> : null}
          <OtpInput
            value={code}
            onChange={(v) => {
              setCode(v);
              if (complete.isError) complete.reset();
            }}
            error={complete.isError}
          />
          <Button title="Continue" disabled={code.length !== 6} loading={complete.isPending} onPress={() => complete.mutate(code)} />
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.duration(350)} style={{ gap: space.md }}>
          <Text variant="title">Confirm it's you</Text>
          <Text muted>
            You're signed in on your {phones}. For your security, approve this new phone from there.
          </Text>
          <Card style={styles.steps}>
            <StepRow n={1} text={`Open GH Trust on your ${phones}`} />
            <StepRow n={2} text={'Tap "Yes, it\'s me" and confirm with your PIN'} />
            <StepRow n={3} text="Type the code it shows here" last />
          </Card>
          <Text variant="small" muted align="center">
            Waiting for approval · {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')} left
          </Text>
        </Animated.View>
      )}
    </Screen>
  );
}

function StepRow({ n, text, last }: { n: number; text: string; last?: boolean }) {
  return (
    <View style={[styles.step, !last && styles.stepDivider]}>
      <View style={styles.stepNum}>
        <Text variant="small" color={colors.white} style={{ fontFamily: 'Montserrat_700Bold' }}>
          {n}
        </Text>
      </View>
      <Text variant="body" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/** Two phones with a signal pulsing from the old one to the new one. */
function Handshake({ approved }: { approved: boolean }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [t]);
  return (
    <View style={styles.handshake} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.phone}>
        <Ionicons name="phone-portrait" size={34} color={colors.navy} />
        <Text variant="caption" muted>
          OTHER PHONE
        </Text>
      </View>
      <View style={styles.dots}>
        {[0, 0.33, 0.66].map((offset) => (
          <PulseDot key={offset} t={t} offset={offset} approved={approved} />
        ))}
      </View>
      <View style={[styles.phone, approved && styles.phoneOk]}>
        <Ionicons
          name={approved ? 'checkmark-circle' : 'phone-portrait-outline'}
          size={34}
          color={approved ? colors.success : colors.cyanDeep}
        />
        <Text variant="caption" muted>
          THIS PHONE
        </Text>
      </View>
    </View>
  );
}

function PulseDot({ t, offset, approved }: { t: SharedValue<number>; offset: number; approved: boolean }) {
  const style = useAnimatedStyle(() => {
    const wave = Math.sin(((t.value + offset) % 1) * Math.PI);
    return { opacity: approved ? 1 : wave, transform: [{ scale: approved ? 1 : 0.6 + wave * 0.5 }] };
  });
  return <Animated.View style={[styles.dot, approved && { backgroundColor: colors.success }, style]} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  hero: { alignItems: 'center', paddingVertical: space.lg },
  handshake: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  phone: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  phoneOk: { borderColor: colors.success, backgroundColor: colors.successBg },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.cyan },
  steps: { paddingVertical: space.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  stepDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
