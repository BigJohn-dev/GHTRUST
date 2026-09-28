import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "error" | "info" | "navy" | "muted";

interface BadgeProps {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
  /** Leading status dot, so state isn't conveyed by colour alone. */
  dot?: boolean;
  /** Pulse the dot: something is in progress / waiting on someone. */
  live?: boolean;
}

// Text colours all meet 4.5:1 on their tinted backgrounds.
const variants: Record<Variant, string> = {
  default: "bg-gray-100 text-gray-600 ring-gray-200",
  muted: "bg-gray-50 text-gray-500 ring-gray-200",
  success: "bg-success-soft text-success ring-success/20",
  warning: "bg-warning-soft text-warning ring-warning/20",
  error: "bg-error-soft text-error ring-error/20",
  info: "bg-cyan-soft text-cyan ring-cyan/20",
  navy: "bg-navy/[0.06] text-navy ring-navy/15",
};

const dots: Record<Variant, string> = {
  default: "bg-gray-400",
  muted: "bg-gray-300",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
  info: "bg-cyan",
  navy: "bg-navy",
};

export function Badge({ children, variant = "default", className, dot = false, live = false }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        variants[variant],
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5" aria-hidden>
          {live && <span className={cn("absolute inset-0 animate-ping rounded-full opacity-60 [animation-duration:1.6s]", dots[variant])} />}
          <span className={cn("relative h-1.5 w-1.5 rounded-full", dots[variant])} />
        </span>
      )}
      {children}
    </span>
  );
}

/** States where work is in flight or waiting on someone. */
const LIVE = new Set(["under_review", "submitted", "pending", "processing", "ready_to_disburse", "documents_incomplete"]);

const STATUS: Record<string, { variant: Variant; label: string }> = {
  completed: { variant: "success", label: "Completed" },
  active: { variant: "success", label: "Active" },
  approved: { variant: "success", label: "Approved" },
  paid: { variant: "success", label: "Paid" },
  pending: { variant: "warning", label: "Pending" },
  under_review: { variant: "info", label: "Under review" },
  failed: { variant: "error", label: "Failed" },
  overdue: { variant: "error", label: "Overdue" },
  rejected: { variant: "error", label: "Rejected" },
  reversed: { variant: "error", label: "Reversed" },
  inactive: { variant: "muted", label: "Inactive" },
  suspended: { variant: "error", label: "Suspended" },
  matured: { variant: "info", label: "Matured" },
  disbursed: { variant: "navy", label: "Disbursed" },
  // Backend loan / payment statuses
  draft: { variant: "muted", label: "Draft" },
  submitted: { variant: "warning", label: "Submitted" },
  documents_incomplete: { variant: "warning", label: "Documents incomplete" },
  ready_to_disburse: { variant: "info", label: "Disbursing" },
  withdrawn: { variant: "muted", label: "Withdrawn" },
  expired: { variant: "muted", label: "Expired" },
  partial: { variant: "warning", label: "Part-paid" },
  written_off: { variant: "error", label: "Written off" },
  verified: { variant: "success", label: "Verified" },
  processing: { variant: "info", label: "Processing" },
  pending_otp: { variant: "warning", label: "Pending OTP" },
};

export function statusLabel(status: string) {
  return STATUS[status]?.label ?? status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const config = STATUS[status] ?? { variant: "default" as const, label: statusLabel(status) };
  return (
    <Badge variant={config.variant} dot live={LIVE.has(status)} className={className}>
      {config.label}
    </Badge>
  );
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, Variant> = {
    teller: "info",
    loan_officer: "warning",
    branch_manager: "navy",
    admin: "error",
  };
  const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={map[role] || "default"}>{label}</Badge>;
}
