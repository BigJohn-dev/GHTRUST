import { Stack } from 'expo-router';

import { useIntroSeen } from '@/lib/intro';
import { colors, font } from '@/theme/tokens';

export default function AuthLayout() {
  const introSeen = useIntroSeen();
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
      <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="sign-in" options={{ title: '' }} />
      <Stack.Screen name="register" options={{ title: '' }} />
      <Stack.Screen name="verify" options={{ title: '' }} />
    </Stack>
  );
}
