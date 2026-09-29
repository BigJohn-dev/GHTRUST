import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { auth } from '@/api/endpoints';
import { ApiError, messageFor } from '@/api/errors';
import { deviceInfo } from '@/auth/device';
import { pendingSelfie } from '@/auth/pending';
import { useSession } from '@/auth/session';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Banner } from '@/components/States';
import { Text } from '@/components/Text';
import { SelfieError, takeSelfie, type Selfie } from '@/features/selfie';
import { colors, space } from '@/theme/tokens';

const TIPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'sunny-outline', text: 'Face a window or light, not behind you' },
  { icon: 'glasses-outline', text: 'Take off glasses, caps and face coverings' },
  { icon: 'happy-outline', text: 'Look straight at the camera, face in the frame' },
];

/**
 * Last step of opening an account: a selfie matched against the photo on the BVN
 * record, so only the BVN's owner can open an account with it.
 */
export default function SelfieStep() {
  const { signIn } = useSession();
  const pending = pendingSelfie.get();
  const [photo, setPhoto] = useState<Selfie | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraOff, setCameraOff] = useState(false);
  const [left, setLeft] = useState(pending?.attemptsLeft ?? 0);
  const [ended, setEnded] = useState<'branch' | 'expired' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pending) router.replace('/register');
  }, [pending]);
  if (!pending) return null;

  const capture = async () => {
    setError(null);
    setCameraOff(false);
    try {
      const shot = await takeSelfie();
      if (shot) setPhoto(shot);
    } catch (err) {
      setCameraOff(err instanceof SelfieError && err.message.startsWith('Camera access'));
      setError(err instanceof Error ? err.message : "We couldn't open the camera.");
    }
  };

  const submit = async () => {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const tokens = await auth.registrationSelfie(pending.token, photo.base64, await deviceInfo());
      pendingSelfie.clear();
      await signIn(tokens); // the app then asks them to create their PINs
    } catch (err) {
      setPhoto(null);
      if (err instanceof ApiError && err.code === 'SELFIE_ATTEMPTS_EXCEEDED') setEnded('branch');
      else if (err instanceof ApiError && err.code === 'REGISTRATION_EXPIRED') setEnded('expired');
      else {
        if (err instanceof ApiError && err.attemptsLeft !== undefined) setLeft(err.attemptsLeft);
        setError(messageFor(err));
      }
    } finally {
      setBusy(false);
    }
  };

  if (ended) {
    return (
      <Screen
        edges={['bottom']}
        scroll={false}
        footer={
          <Button
            title={ended === 'expired' ? 'Start again' : 'Back to start'}
            onPress={() => {
              pendingSelfie.clear();
              router.replace(ended === 'expired' ? '/register' : '/welcome');
            }}
          />
        }>
        <View style={styles.center}>
          <View style={[styles.badge, { backgroundColor: colors.warningBg }]}>
            <Ionicons name={ended === 'expired' ? 'time-outline' : 'business-outline'} size={34} color={colors.warning} />
          </View>
          <Text variant="title" align="center">
            {ended === 'expired' ? 'Sign-up expired' : 'Visit a branch to finish'}
          </Text>
          <Text muted align="center">
            {ended === 'expired'
              ? 'For your security, this sign-up timed out. Start again with your BVN.'
              : "We couldn't match your selfie to your BVN photo. Bring a valid ID to any GH Trust branch and we'll open your account there."}
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      edges={['bottom']}
      footer={
        photo ? (
          <>
            <Button title="Use this photo" icon="checkmark" loading={busy} onPress={submit} />
            <Button title="Retake" variant="ghost" onPress={capture} disabled={busy} />
          </>
        ) : cameraOff ? (
          <Button title="Open Settings" icon="settings-outline" onPress={() => Linking.openSettings()} />
        ) : (
          <Button title="Take selfie" icon="camera-outline" onPress={capture} />
        )
      }>
      <Animated.View entering={FadeInDown.duration(350)} style={{ gap: space.xs }}>
        <Text variant="caption" color={colors.cyanDeep}>
          LAST STEP
        </Text>
        <Text variant="title">Take a quick selfie, {pending.firstName}</Text>
        <Text muted>We'll match it to the photo on your BVN record, so no one else can open an account in your name.</Text>
      </Animated.View>

      {error ? <Banner message={error} /> : null}

      <Animated.View entering={FadeIn.duration(400)} style={styles.frameWrap}>
        <View style={styles.frame}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" accessibilityLabel="Your selfie" />
          ) : (
            <Ionicons name="person-outline" size={96} color={colors.borderStrong} />
          )}
        </View>
        {left > 0 && left < (pending.attemptsLeft ?? 3) ? (
          <Text variant="small" color={colors.warning} align="center">
            {left} {left === 1 ? 'try' : 'tries'} left
          </Text>
        ) : null}
      </Animated.View>

      {!photo ? (
        <Card style={styles.tips}>
          {TIPS.map((t) => (
            <View key={t.icon} style={styles.tip}>
              <Ionicons name={t.icon} size={18} color={colors.cyanDeep} />
              <Text variant="small" style={{ flex: 1 }}>
                {t.text}
              </Text>
            </View>
          ))}
        </Card>
      ) : null}
      <Text variant="small" muted align="center">
        Your selfie is only used to confirm it's you.
      </Text>
    </Screen>
  );
}

const FRAME = 220;

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  frameWrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  frame: {
    width: FRAME,
    height: FRAME * 1.2,
    borderRadius: FRAME / 2,
    borderWidth: 3,
    borderColor: colors.cyan,
    borderStyle: 'dashed',
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  tips: { gap: space.sm },
  tip: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
