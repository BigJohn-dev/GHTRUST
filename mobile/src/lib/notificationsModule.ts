/**
 * expo-notifications, or null where it can't load. Expo Go removed Android push in
 * SDK 53 and throws as soon as the module is imported, which would take down every
 * signed-in screen. Push needs a development build anyway, so in Expo Go it's off.
 */
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

export type NotificationsModule = typeof import('expo-notifications');

export const Notifications: NotificationsModule | null =
  Platform.OS === 'web' || isRunningInExpoGo()
    ? null
    : // eslint-disable-next-line @typescript-eslint/no-require-imports
      (require('expo-notifications') as NotificationsModule);
