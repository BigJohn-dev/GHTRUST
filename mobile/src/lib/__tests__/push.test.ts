import { describe, expect, it, jest } from '@jest/globals';

// Expo Go on Android throws as soon as expo-notifications is imported (SDK 53+).
jest.mock('expo-notifications', () => {
  throw new Error('expo-notifications: removed from Expo Go');
});
jest.mock('expo', () => ({
  ...(jest.requireActual('expo') as object),
  isRunningInExpoGo: () => true,
}));
jest.mock('@/api/endpoints', () => ({ notifications: {} }));

describe('push in Expo Go', () => {
  it('loads without expo-notifications and reports push as unsupported', async () => {
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { Notifications } = require('../notificationsModule');
    const push = require('../push');
    const { usePushNotifications } = require('../usePushNotifications');
    /* eslint-enable @typescript-eslint/no-require-imports */

    expect(Notifications).toBeNull();
    expect(push.pushSupported).toBe(false);
    await expect(push.pushState()).resolves.toBe('unsupported');
    await expect(push.shouldOfferPush()).resolves.toBe(false);
    await expect(push.enablePush()).resolves.toBe('unsupported');
    expect(usePushNotifications(true)).toBeUndefined();
  });
});
