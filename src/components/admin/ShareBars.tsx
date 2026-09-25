"use client";

import { cn } from "@/lib/utils";

/** Brand series colour, shared with the column chart. */
const SERIES = "#1B2F6B";

/** Horizontal bars with the label and value written beside each bar. */
export function ShareBars({
  items,
  max,
  valueFormat = (v) => String(v),
  className,
}: {
  items: { key: string; label: string; value: number; sub?: string; tone?: string }[];
  /** Scale; defaults to the largest value. */
  max?: number;
  valueFormat?: (v: number) => string;
  className?: string;
}) {
  const scale = Math.max(1, max ?? Math.max(0, ...items.map((i) => i.value)));
  return (
    <ul className={cn("space-y-3.5", className)}>
      {items.map((i, idx) => (
        <li key={i.key}>
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-2">{i.label}</span>
            <span className="num shrink-0 font-semibold text-ink">
              {valueFormat(i.value)}
              {i.sub && <span className="ml-1.5 font-normal text-ink-3">{i.sub}</span>}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full origin-left animate-grow-x rounded-full transition-[width] duration-500"
              style={{
                width: `${Math.max(i.value > 0 ? 2 : 0, (i.value / scale) * 100)}%`,
                background: i.tone ?? SERIES,
                animationDelay: `${idx * 70}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
