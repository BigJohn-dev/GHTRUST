/**
 * Small in-memory switches that steer navigation guards across screens.
 *
 * - `pinReset`: the customer tapped "Forgot PIN?". They sign in with an SMS code, then
 *   choose a new sign-in PIN before reaching their account.
 * - `setupFlow`: the security setup (sign-in PIN, then optional transaction PIN and
 *   biometrics) is on screen. It stays up until the customer finishes, even though the
 *   sign-in PIN — which is what triggered it — is set after the first step.
 */
import { useSyncExternalStore } from 'react';

function flag() {
  let on = false;
  const listeners = new Set<() => void>();
  const set = (next: boolean) => {
    if (next === on) return;
    on = next;
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  return {
    start: () => set(true),
    finish: () => set(false),
    get: () => on,
    subscribe,
  };
}

export const pinReset = flag();
export const setupFlow = flag();

export const usePinReset = () => useSyncExternalStore(pinReset.subscribe, pinReset.get);
export const useSetupFlow = () => useSyncExternalStore(setupFlow.subscribe, setupFlow.get);
