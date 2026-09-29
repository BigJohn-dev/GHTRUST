/**
 * App lock: a saved session only opens with the customer's 6-digit sign-in PIN, or with
 * Face ID / fingerprint if they chose to turn that on for this phone.
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

/** Background time after which the app locks again (matches the staff portal). */
export const RELOCK_AFTER_MS = 5 * 60 * 1000;

export type BiometricKind = 'face' | 'fingerprint';

/** What this phone offers for biometrics right now (hardware present and enrolled), if anything. */
export async function biometricKind(): Promise<BiometricKind | null> {
  if (Platform.OS === 'web') return null;
  try {
    const [hardware, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!hardware || !enrolled) return null;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return 'face';
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'fingerprint';
    return null;
  } catch {
    return null;
  }
}

export function biometricName(kind: BiometricKind): string {
  if (kind === 'face') return Platform.OS === 'ios' ? 'Face ID' : 'face unlock';
  return Platform.OS === 'ios' ? 'Touch ID' : 'fingerprint';
}

/** Ask for a biometric check only; the PIN is the fallback, never the phone's passcode. */
export async function checkBiometric(promptMessage: string): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: true,
    });
    return result.success;
  } catch {
    return false;
  }
}
