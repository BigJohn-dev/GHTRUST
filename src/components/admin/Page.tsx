"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronLeft, Search, X } from "lucide-react";
import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "./States";
import { AnimatedNumber } from "./AnimatedNumber";

// ── Page header ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  /** Badges or small facts shown next to the title. */
  meta?: React.ReactNode;
}) {
  return (
    <header className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 rounded text-[13px] font-medium text-ink-3 transition-colors hover:text-ink"
        >
          <ChevronLeft className="h-4 w-4" /> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-[22px] font-semibold leading-8 text-ink">{title}</h1>
            {meta}
          </div>
          {description && <p className="mt-1 max-w-3xl text-sm text-ink-3">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

// ── KPI tile ────────────────────────────────────────────────────────────────

const TONES = {
  default: "text-ink",
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  info: "text-cyan",
};

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  href,
  loading = false,
  emphasis = false,
  format,
}: {
  label: string;
  /** Numbers count up on appearance (use `format` for money etc.). */
  value: React.ReactNode;
  format?: (n: number) => string;
  hint?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: keyof typeof TONES;
  href?: string;
  loading?: boolean;
  /** Dark navy tile for the headline figure on a page. */
  emphasis?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[13px] font-medium", emphasis ? "text-white/75" : "text-ink-3")}>{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              emphasis ? "bg-white/10 text-cyan-bright" : "bg-gray-100 text-ink-3",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <p
          className={cn(
            "num mt-1 truncate text-[26px] font-semibold leading-9 tracking-tight",
            emphasis ? "text-white" : TONES[tone],
          )}
        >
          {typeof value === "number" ? <AnimatedNumber value={value} format={format} /> : value}
        </p>
      )}
      {hint && <div className={cn("mt-1 truncate text-xs", emphasis ? "text-white/65" : "text-ink-3")}>{hint}</div>}
      {href && (
        <ArrowUpRight
          className={cn(
            "absolute bottom-4 right-4 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100",
            emphasis ? "text-white/70" : "text-ink-3",
          )}
          aria-hidden
        />
      )}
    </>
  );
  const cls = cn(
    "group relative block min-w-0 rounded-xl border p-5 shadow-card",
    emphasis ? "border-navy-900 gradient-navy" : "border-line bg-white",
    href &&
      "transition-[box-shadow,border-color,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-line-strong hover:shadow-card-hover active:translate-y-0",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ── Filters ─────────────────────────────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

/** Segmented status filter. Counts are shown when known. */
export function FilterTabs({
  options,
  value,
  onChange,
  label = "Filter",
  className,
}: {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn("scrollbar-none -mb-px flex max-w-full gap-1 overflow-x-auto", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors",
              active ? "border-navy text-ink" : "border-transparent text-ink-3 hover:border-line-strong hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  "num rounded-full px-1.5 py-px text-2xs font-semibold",
                  active ? "bg-navy text-white" : "bg-gray-100 text-ink-3",
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const SearchInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
    value: string;
    onChange: (value: string) => void;
    containerClassName?: string;
  }
>(function SearchInput({ value, onChange, containerClassName, className, ...props }, ref) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-300" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("input h-9 pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden", className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-ink-3 hover:bg-gray-100 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

/** Compact select for toolbars. */
export function SelectFilter({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn("input h-9 w-auto", className)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ── Forms ───────────────────────────────────────────────────────────────────

/** Label + control + helper text, wired together for screen readers. */
export function Field({
  label,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: (id: string, describedBy?: string) => React.ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required && <span className="text-error"> *</span>}
      </label>
      {children(id, hint ? hintId : undefined)}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-ink-3">
          {hint}
        </p>
      )}
    </div>
  );
}

// ── Tables & lists ──────────────────────────────────────────────────────────

/** Scroll container for `.tbl` tables. With `maxHeight`, the header stays pinned. */
export function TableShell({
  children,
  maxHeight,
  className,
}: {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}) {
  return (
    <div className={cn("scrollbar-thin overflow-auto", className)} style={maxHeight ? { maxHeight } : undefined}>
      {children}
    </div>
  );
}

/** Two-column facts list (label above value). */
export function DescriptionList({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: React.ReactNode; mono?: boolean }[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 xl:grid-cols-3", 4: "sm:grid-cols-2 xl:grid-cols-4" }[columns];
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 text-sm", cols, className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-ink-3">{item.label}</dt>
          <dd className={cn("mt-0.5 break-words font-medium text-ink", item.mono && "num font-mono text-[13px]")}>
            {item.value === null || item.value === undefined || item.value === "" ? <span className="text-gray-300">—</span> : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Avatar with initials. */
export function Initials({ name, size = "md", className }: { name?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const text =
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "—";
  const dims = { sm: "h-7 w-7 text-2xs", md: "h-8 w-8 text-xs", lg: "h-14 w-14 text-lg" }[size];
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-navy/[0.07] font-semibold text-navy", dims, className)}
      aria-hidden
    >
      {text}
    </span>
  );
}
