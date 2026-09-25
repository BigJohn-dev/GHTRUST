"use client";

import { AlertCircle, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Inbox, Info, PlugZap, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/** Plain loading line; screens with a known shape use the skeletons below instead. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-ink-3" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-cyan" aria-hidden />
      {label}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function TableSkeleton({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden" role="status" aria-label="Loading">
      <div className="flex gap-6 border-b border-line bg-bg-light px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-line/70 px-4 py-4 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3.5 flex-1", c === 0 && "flex-[1.6]")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatSkeletonRow({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-white p-5 shadow-card">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-4 h-7 w-32" />
          <Skeleton className="mt-3 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Generic page placeholder: header, KPI row and a table card. */
export function PageSkeleton({ stats = true }: { stats?: boolean }) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading page">
      <div>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2.5 h-3.5 w-80 max-w-full" />
      </div>
      {stats && <StatSkeletonRow />}
      <div className="rounded-xl border border-line bg-white shadow-card">
        <TableSkeleton />
      </div>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-error/20 bg-error-soft px-6 py-10 text-center" role="alert">
      <AlertCircle className="h-6 w-6 text-error" />
      <p className="max-w-md text-sm text-ink">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      )}
    </div>
  );
}

export function Empty({
  title,
  hint,
  icon: Icon = Inbox,
  action,
  compact = false,
}: {
  title: string;
  hint?: string;
  icon?: typeof Inbox;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 text-center", compact ? "py-8" : "py-14")}>
      <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="max-w-sm text-xs text-ink-3">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const NOTICE = {
  info: { box: "border-cyan/20 bg-cyan-soft text-ink", icon: Info, iconCls: "text-cyan" },
  warning: { box: "border-warning/25 bg-warning-soft text-ink", icon: AlertTriangle, iconCls: "text-warning" },
  success: { box: "border-success/20 bg-success-soft text-ink", icon: CheckCircle2, iconCls: "text-success" },
  error: { box: "border-error/20 bg-error-soft text-ink", icon: AlertCircle, iconCls: "text-error" },
};

/** Inline callout for guidance, warnings and blockers. Icon + text, never colour alone. */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof NOTICE;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const t = NOTICE[tone];
  return (
    <div className={cn("flex animate-fade-up gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13px] leading-5", t.box, className)} role={tone === "error" ? "alert" : undefined}>
      <t.icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.iconCls)} aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5 text-ink-2")}>{children}</div>}
      </div>
    </div>
  );
}

/** For screens whose backend feature isn't built yet — said plainly, no fake data. */
export function NotLiveYet({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-dashed border-line-strong bg-white px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
        <PlugZap className="h-[18px] w-[18px] text-ink-3" />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-0.5 max-w-3xl text-[13px] text-ink-3">{detail}</p>
      </div>
    </div>
  );
}

export function InlineError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Notice tone="error">
      <span className="text-error">{message}</span>
    </Notice>
  );
}

/** "Showing 1–50 of 230" with previous/next. `total` may be unknown (APIs that don't count). */
export function Pager({
  total,
  limit,
  offset,
  onChange,
  pageItems,
  className,
}: {
  total?: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
  /** Items on this page — used to decide whether "next" exists when total is unknown. */
  pageItems?: number;
  className?: string;
}) {
  const known = typeof total === "number";
  const count = known ? total! : offset + (pageItems ?? 0);
  if (known && total! <= limit && offset === 0) return null;
  if (!known && offset === 0 && (pageItems ?? 0) < limit) return null;
  const end = known ? Math.min(offset + limit, total!) : offset + (pageItems ?? 0);
  const hasNext = known ? end < total! : (pageItems ?? 0) >= limit;
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-ink-3", className)}>
      <span className="num">
        {count === 0 ? "No results" : <>Showing <strong className="font-semibold text-ink-2">{offset + 1}–{end}</strong>{known && <> of <strong className="font-semibold text-ink-2">{total}</strong></>}</>}
      </span>
      <div className="flex gap-1.5">
        <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" /> Prev
        </Button>
        <Button size="sm" variant="outline" disabled={!hasNext} onClick={() => onChange(offset + limit)} aria-label="Next page">
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
