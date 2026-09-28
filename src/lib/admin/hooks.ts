"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";
import { cacheGet, cacheSet, dedupe } from "./cache";

export interface Resource<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Load data from the API with stale-while-revalidate caching.
 *
 * - Paints instantly from the in-memory cache when this data was seen before, then
 *   revalidates quietly (no skeleton flash) unless it's only seconds old.
 * - Re-runs when `deps` change; responses from superseded requests are ignored so
 *   fast filter changes can't show stale results.
 * - `key` names the cache entry (needed for prefetching); by default it's derived
 *   from the loader's source and `deps`, which must list every value it closes over.
 */
export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = [], options: { key?: string } = {}): Resource<T> {
  const key = options.key ?? `${loader.toString()}|${JSON.stringify(deps)}`;
  const [data, setData] = useState<T | undefined>(() => cacheGet<T>(key)?.data);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !cacheGet(key));
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);
  const forced = useRef(false);

  useEffect(() => {
    const id = ++requestId.current;
    const cached = cacheGet<T>(key);
    if (cached) {
      setData(cached.data);
      setLoading(false);
      if (cached.fresh && !forced.current) return;
    } else {
      setLoading(true);
    }
    forced.current = false;
    setError(null);
    dedupe(key, loader)
      .then((result) => {
        cacheSet(key, result);
        if (id === requestId.current) setData(result);
      })
      .catch((err: unknown) => {
        if (id === requestId.current) setError(errorMessage(err));
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => {
    forced.current = true;
    setNonce((n) => n + 1);
  }, []);
  return { data, error, loading, reload };
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 403) return "You don't have permission to do this.";
    if (err.errors?.length) return `${err.message}: ${err.errors.join(", ")}`;
    return err.message;
  }
  if (err instanceof TypeError) return "Can't reach the GH Trust API. Check your connection.";
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Run a mutation with a busy flag and error capture. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (err) {
      setError(errorMessage(err));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  return { busy, error, setError, run };
}

/** The value, once it has stopped changing for `ms` — for search-as-you-type without a request per keystroke. */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}
