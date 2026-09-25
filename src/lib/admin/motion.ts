"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Keep something mounted long enough to play its exit animation.
 * `closing` is true for `exitMs` after `open` turns false.
 */
export function usePresence(open: boolean, exitMs = 150): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    if (!mounted) return;
    const t = setTimeout(() => setMounted(false), prefersReducedMotion() ? 0 : exitMs);
    return () => clearTimeout(t);
  }, [open, mounted, exitMs]);
  return { mounted: open || mounted, closing: !open && mounted };
}

// ── Route transitions (View Transitions API) ─────────────────────────────────

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => Promise<void> | void) => { finished: Promise<void> };
};

let settleRoute: (() => void) | null = null;

/**
 * Navigate with a cross-fade of the content area. The browser snapshots the old
 * page, we navigate, and the snapshot is released once the new route has
 * rendered (see `routeRendered`). Falls back to a plain navigation where the API
 * isn't supported or reduced motion is requested.
 */
export function transitionTo(navigate: () => void) {
  const doc = document as ViewTransitionDocument;
  if (!doc.startViewTransition || prefersReducedMotion()) {
    navigate();
    return;
  }
  // Navigate exactly once — from inside the transition normally, or from the
  // watchdog if the browser never starts it (e.g. rendering is paused in a
  // background window). A route change must never wait on an animation.
  let navigated = false;
  const go = () => {
    if (!navigated) {
      navigated = true;
      navigate();
    }
  };
  const root = document.documentElement;
  root.classList.add("vt-active");
  const clear = () => root.classList.remove("vt-active");
  const watchdog = setTimeout(() => {
    go();
    clear();
  }, 300);
  const vt = doc.startViewTransition(
    () =>
      new Promise<void>((resolve) => {
        clearTimeout(watchdog);
        settleRoute?.();
        settleRoute = resolve;
        go();
        setTimeout(resolve, 1200); // never hold the snapshot longer than this
      }),
  );
  vt.finished.catch(() => undefined).finally(clear);
}

/** Call once the new route has committed to the DOM. */
export function routeRendered() {
  settleRoute?.();
  settleRoute = null;
}

/** `router.push/replace` that animate between pages. */
export function useTransitionRouter() {
  const router = useRouter();
  return useMemo(
    () => ({
      push: (href: string) => transitionTo(() => router.push(href)),
      replace: (href: string, opts?: { scroll?: boolean }) => router.replace(href, opts),
      prefetch: (href: string) => router.prefetch(href),
    }),
    [router],
  );
}

/** A soft tick on touch devices for primary actions (no-op elsewhere). */
export function haptic(ms = 8) {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (!window.matchMedia?.("(pointer: coarse)").matches) return;
  try {
    navigator.vibrate(ms);
  } catch {
    /* unsupported */
  }
}
