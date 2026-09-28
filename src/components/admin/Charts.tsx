"use client";

import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "./States";

/**
 * Single-series charts in one brand hue. Identity comes from direct labels, so
 * no categorical palette is needed; grid and axes stay recessive.
 */
const INK_3 = "#667085";
const GRID = "#EAECF0";
const SERIES = "#1B2F6B";
const SERIES_HOVER = "#0A74A6";

/** Recharts measures the DOM, so render only after mount inside a fixed-height box. */
function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

function ChartTooltip({
  active,
  payload,
  label,
  unit,
  format,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
  format?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-pop">
      <p className="font-medium text-ink-3">{label}</p>
      <p className="num mt-0.5 text-sm font-semibold text-ink">
        {format ? format(v) : v} <span className="font-normal text-ink-3">{unit}</span>
      </p>
    </div>
  );
}

export function ColumnChart({
  data,
  x,
  y,
  unit,
  height = 240,
  format,
  ariaLabel,
}: {
  data: Record<string, string | number>[];
  x: string;
  y: string;
  unit: string;
  height?: number;
  format?: (v: number) => string;
  /** Text summary for screen readers (the chart itself is not accessible). */
  ariaLabel: string;
}) {
  const mounted = useMounted();
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      {!mounted ? (
        <Skeleton className="h-full w-full rounded-lg" />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey={x} tick={{ fontSize: 11, fill: INK_3 }} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: INK_3 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: "rgba(16,24,40,0.04)" }}
              content={<ChartTooltip unit={unit} format={format} />}
            />
            <Bar
              dataKey={y}
              fill={SERIES}
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              activeBar={{ fill: SERIES_HOVER }}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
