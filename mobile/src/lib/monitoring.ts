/**
 * Crash and error reporting (Sentry). Off unless EXPO_PUBLIC_SENTRY_DSN is set at build
 * time, and never on the web preview.
 *
 * Reports carry the backend `request_id` of the call that failed (the app sends its own
 * X-Request-ID, which the API reuses in its logs and its Sentry events), so one ID links
 * the phone's report to the server's.
 *
 * No personal data: only the customer's internal ID is attached; request bodies,
 * headers and query strings are stripped.
 */
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { ApiError } from '@/api/errors';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const monitoringEnabled = !!DSN && Platform.OS !== 'web';

const stripQuery = (url: unknown) => (typeof url === 'string' ? url.split('?')[0] : url);

export function initMonitoring() {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
    release: `ghtrust-mobile@${Constants.expoConfig?.version ?? 'unknown'}`,
    sendDefaultPii: false,
    // Crash-free sessions yes; performance tracing off until there's a reason to pay for it.
    enableAutoSessionTracking: true,
    tracesSampleRate: 0,
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        breadcrumb.data = {
          method: breadcrumb.data?.method,
          url: stripQuery(breadcrumb.data?.url),
          status_code: breadcrumb.data?.status_code,
        };
      }
      return breadcrumb;
    },
    beforeSend(event) {
      if (event.request)
        event.request = { url: stripQuery(event.request.url) as string | undefined, method: event.request.method };
      if (event.user) event.user = { id: event.user.id };
      return event;
    },
  });
}

/** Attach the signed-in customer's internal ID (nothing else) to reports; null on sign-out. */
export function setMonitoringUser(id: string | null) {
  if (monitoringEnabled) Sentry.setUser(id ? { id } : null);
}

/**
 * Report something that shouldn't happen. Expected failures (wrong PIN, offline, a 4xx
 * the screen explains) are not reported; server errors and app exceptions are.
 */
export function reportError(error: unknown, context: Record<string, string> = {}) {
  if (!monitoringEnabled) return;
  if (error instanceof ApiError) {
    if (error.status > 0 && error.status < 500) return;
    if (error.code === 'NETWORK' || error.code === 'TIMEOUT') return;
    Sentry.captureException(error, {
      tags: {
        api_code: error.code,
        api_status: String(error.status),
        request_id: error.requestId ?? 'none',
        ...context,
      },
    });
    return;
  }
  Sentry.captureException(error, { tags: context });
}

/** Wraps the root component so native crashes and touch breadcrumbs are captured. */
export const withMonitoring = (Root: () => React.JSX.Element) => (monitoringEnabled ? Sentry.wrap(Root) : Root);
