import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * API origin. Set EXPO_PUBLIC_API_URL for staging/production builds.
 *
 * In development it defaults to port 8000 on the machine running Metro, so a
 * phone on the same Wi-Fi (Expo Go) reaches your local backend without config.
 * The backend must listen on 0.0.0.0 for that (see mobile/README.md). Both the real
 * backend and backend/scripts/dev_server.py use port 8000.
 */
const DEV_PORT = 8000;

function devOrigin(): string {
  if (Platform.OS === 'web') return `http://localhost:${DEV_PORT}`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (host) return `http://${host}:${DEV_PORT}`;
  return Platform.OS === 'android' ? `http://10.0.2.2:${DEV_PORT}` : `http://localhost:${DEV_PORT}`;
}

export const API_ORIGIN = (process.env.EXPO_PUBLIC_API_URL || devOrigin()).replace(/\/+$/, '');

// A release build must talk to the API over HTTPS: PINs, BVNs and tokens travel on it.
// Failing at start-up makes a build with a missing or http:// EXPO_PUBLIC_API_URL
// obvious in testing, instead of quietly sending data unencrypted. Only the end-to-end
// test build (against a local dev server) sets EXPO_PUBLIC_ALLOW_INSECURE_API.
if (
  !__DEV__ &&
  Platform.OS !== 'web' &&
  !API_ORIGIN.startsWith('https://') &&
  process.env.EXPO_PUBLIC_ALLOW_INSECURE_API !== '1'
) {
  throw new Error(`Release builds need an https EXPO_PUBLIC_API_URL (got "${API_ORIGIN}").`);
}
export const API_BASE = `${API_ORIGIN}/api/v1`;

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

/** The version gate only knows ios/android; web previews report as android. */
export const GATE_PLATFORM: 'ios' | 'android' = Platform.OS === 'ios' ? 'ios' : 'android';
