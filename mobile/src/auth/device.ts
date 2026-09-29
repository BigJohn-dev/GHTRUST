import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { APP_VERSION } from '@/api/config';
import type { DeviceInfo } from '@/api/types';

import { getDeviceId, tokenStore } from './storage';

/** Sent with every sign-in so "Signed-in devices" is meaningful and trusted phones are recognised. */
export async function deviceInfo(): Promise<DeviceInfo> {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const name = [Device.manufacturer, Device.modelName].filter(Boolean).join(' ') || Device.deviceName;
  return {
    device_id: await getDeviceId(),
    device_name: name || (platform === 'web' ? 'Web browser' : 'Mobile device'),
    platform,
    app_version: APP_VERSION,
    // Proves this phone is already trusted, so signing in here needs no approval.
    device_token: (await tokenStore.getDeviceToken()) ?? undefined,
  };
}
