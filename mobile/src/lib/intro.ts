/**
 * First-launch intro: shown once per install, before the welcome screen.
 * `null` while the flag is being read (the splash covers that moment).
 */
import { useSyncExternalStore } from 'react';

import { introFlag } from '@/auth/storage';

let seen: boolean | null = null;
const listeners = new Set<() => void>();

function emit(next: boolean) {
  seen = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Call once at start-up. A storage failure skips the intro rather than blocking the app. */
export function loadIntro() {
  introFlag
    .get()
    .then(emit)
    .catch(() => emit(true));
}

export function useIntroSeen() {
  return useSyncExternalStore(subscribe, () => seen);
}

export function finishIntro() {
  emit(true);
  introFlag.set().catch(() => undefined);
}
