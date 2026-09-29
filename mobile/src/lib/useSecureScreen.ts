import * as ScreenCapture from 'expo-screen-capture';

/**
 * Blocks screenshots and screen recording while the calling screen is shown (Android also
 * hides it from the recent-apps thumbnail). Used where a PIN or one-time code is on screen:
 * fraudsters commonly ask customers to "just send a screenshot".
 */
export function useSecureScreen(key: string) {
  ScreenCapture.usePreventScreenCapture(key);
}

/** iOS: blur the app in the app switcher, so balances aren't visible there. */
export function protectAppSwitcher() {
  ScreenCapture.enableAppSwitcherProtectionAsync(0.9).catch(() => undefined);
}
