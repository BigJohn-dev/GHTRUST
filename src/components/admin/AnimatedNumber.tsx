"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/admin/motion";

/**
 * Counts up to `value` on first appearance and tweens between values after that.
 * The final formatted value is always in the DOM for screen readers (aria-label).
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString("en-NG"),
  duration = 900,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  const latest = useRef(0); // what's on screen right now, so interrupted tweens continue smoothly
  const frame = useRef<number>(0);

  useEffect(() => {
    if (prefersReducedMotion() || !Number.isFinite(value)) {
      setShown(value);
      from.current = latest.current = value;
      return;
    }
    const start = performance.now();
    const origin = from.current;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 4); // easeOutQuart
      const current = origin + (value - origin) * eased;
      latest.current = current;
      setShown(current);
      if (p < 1) frame.current = requestAnimationFrame(step);
      else from.current = value;
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame.current);
      from.current = latest.current;
    };
  }, [value, duration]);

  return (
    <span aria-label={format(value)}>
      <span aria-hidden>{format(shown)}</span>
    </span>
  );
}
