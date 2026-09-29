import { useQueryClient } from '@tanstack/react-query';
import { router, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';

import { notifications } from '@/api/endpoints';
import { Notifications, type NotificationsModule } from '@/lib/notificationsModule';
import { syncPushToken } from '@/lib/push';

/**
 * Keeps this phone's push token registered, refreshes data when a notification arrives
 * while the app is open, and opens the right screen when one is tapped.
 * A no-op in Expo Go, where push needs a development build.
 */
export const usePushNotifications: (enabled: boolean) => void = Notifications
  ? makePushHook(Notifications)
  : () => {};

function makePushHook(N: NotificationsModule) {
  return function useNativePush(enabled: boolean) {
    const queryClient = useQueryClient();
    const response = N.useLastNotificationResponse();
    const handled = useRef<string | null>(null);

    useEffect(() => {
      if (enabled) syncPushToken();
    }, [enabled]);

    useEffect(() => {
      if (!enabled) return;
      // Whatever it's about (money in, a decision, a reminder), the screens showing it should update.
      const sub = N.addNotificationReceivedListener(() => queryClient.invalidateQueries());
      return () => sub.remove();
    }, [enabled, queryClient]);

    useEffect(() => {
      if (!enabled || !response || response.actionIdentifier !== N.DEFAULT_ACTION_IDENTIFIER) return;
      const { identifier, content } = response.notification.request;
      if (handled.current === identifier) return;
      handled.current = identifier;
      const data = (content.data ?? {}) as { url?: string; notification_id?: string };
      if (data.notification_id) {
        notifications
          .markRead([data.notification_id])
          .then(() => queryClient.invalidateQueries({ queryKey: ['notifications'] }))
          .catch(() => undefined);
      }
      if (typeof data.url === 'string' && data.url.startsWith('/')) router.push(data.url as Href);
    }, [enabled, response, queryClient]);
  };
}
