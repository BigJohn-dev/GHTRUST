import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "navy";
  className?: string;
}

const variants = {
  default: "bg-gray-100 text-gray-700",
  success: "bg-green-50 text-success",
  warning: "bg-amber-50 text-warning",
  error: "bg-red-50 text-error",
  info: "bg-blue-50 text-cyan",
  navy: "bg-navy/10 text-navy",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold", variants[variant], className)}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
    completed: { variant: "success", label: "Completed" },
    active: { variant: "success", label: "Active" },
    approved: { variant: "success", label: "Approved" },
    paid: { variant: "success", label: "Paid" },
    pending: { variant: "warning", label: "Pending" },
    under_review: { variant: "info", label: "Under Review" },
    failed: { variant: "error", label: "Failed" },
    overdue: { variant: "error", label: "Overdue" },
    rejected: { variant: "error", label: "Rejected" },
    reversed: { variant: "error", label: "Reversed" },
    inactive: { variant: "default", label: "Inactive" },
    suspended: { variant: "error", label: "Suspended" },
    matured: { variant: "info", label: "Matured" },
    disbursed: { variant: "success", label: "Disbursed" },
  };
  const config = map[status] || { variant: "default" as const, label: status };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function RoleBadge({ role }: { role: string }) {
  const map: Record<string, BadgeProps["variant"]> = {
    teller: "info",
    loan_officer: "warning",
    branch_manager: "navy",
    admin: "error",
  };
  const label = role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <Badge variant={map[role] || "default"}>{label}</Badge>;
}
