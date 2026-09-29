import { Stack } from 'expo-router';

import { useSession } from '@/auth/session';
import { usePinReset } from '@/lib/flags';
import { useIntroSeen } from '@/lib/intro';
import { colors, font } from '@/theme/tokens';

export default function AuthLayout() {
  const introSeen = useIntroSeen();
  const { trusted } = useSession();
  const resetting = usePinReset();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerTransparent: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.navy,
        headerTitleStyle: { fontFamily: font.semibold, fontSize: 16 },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.surface },
      }}>
      {/* First launch only; finishing it drops the guard and lands on welcome. */}
      <Stack.Protected guard={!introSeen}>
        <Stack.Screen name="intro" options={{ headerShown: false, animation: 'fade' }} />
      </Stack.Protected>
      {/* A phone that signed in before opens on the PIN pad instead of the welcome screen. */}
      <Stack.Protected guard={!!introSeen && trusted && !resetting}>
        <Stack.Screen name="pin-sign-in" options={{ headerShown: false, animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="sign-in" options={{ title: '' }} />
      <Stack.Screen name="register" options={{ title: '' }} />
      <Stack.Screen name="verify" options={{ title: '' }} />
      <Stack.Screen
        name="approval-wait"
        options={{ title: '', gestureEnabled: false, headerBackVisible: false, headerLeft: () => null }}
      />
      <Stack.Screen name="lost-phone" options={{ title: '' }} />
    </Stack>
  );
}
