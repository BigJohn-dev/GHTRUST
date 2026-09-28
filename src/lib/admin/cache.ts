"use client";

/**
 * In-memory stale-while-revalidate cache for API reads.
 *
 * Screens render instantly from the last response while a fresh one loads in the
 * background; identical in-flight requests are shared. Any write (POST/PATCH/…)
 * marks everything stale so the next view revalidates, and sign-out wipes it so no
 * previous user's data survives. Memory only — nothing is persisted.
 */

interface Entry {
  data: unknown;
  at: number;
}

/** Reads younger than this are reused without a network round-trip. */
export const FRESH_MS = 5_000;
const MAX_ENTRIES = 200;

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export function cacheGet<T>(key: string): { data: T; fresh: boolean } | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  return { data: entry.data as T, fresh: Date.now() - entry.at < FRESH_MS };
}

export function cacheSet(key: string, data: unknown) {
  store.delete(key); // re-insert to keep Map order = recency
  store.set(key, { data, at: Date.now() });
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value!);
}

/** Run `loader` once per key at a time; concurrent callers share the result. */
export function dedupe<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = loader().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** After a write: keep data for instant paint, but force revalidation everywhere. */
export function markAllStale() {
  store.forEach((entry) => (entry.at = 0));
}

export function clearResourceCache() {
  store.clear();
  inflight.clear();
}

/** Warm the cache for a screen the user is about to open (e.g. on hover). */
export function prefetch<T>(key: string, loader: () => Promise<T>) {
  if (cacheGet(key)?.fresh || inflight.has(key)) return;
  dedupe(key, loader)
    .then((data) => cacheSet(key, data))
    .catch(() => undefined);
}
