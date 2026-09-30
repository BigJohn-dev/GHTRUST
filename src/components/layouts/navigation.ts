import {
  ArrowLeftRight, BarChart3, Bell, ClipboardList, FileText, HandCoins, LayoutDashboard,
  Package, PiggyBank, ScanFace, Settings, Shield, Users, UsersRound,
} from "lucide-react";
import { P } from "@/lib/admin/auth";

export interface NavItem {
  href: string;
  label: string;
  section: string;
  icon: typeof LayoutDashboard;
  /** Shown if the staff member has ANY of these (empty = everyone). */
  anyOf: string[];
  /** Backend not built yet — the screen explains what's missing. */
  soon?: boolean;
}

export const NAV_SECTIONS = ["Overview", "Lending", "Customers & money", "Administration"] as const;

export const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", section: "Overview", icon: LayoutDashboard, anyOf: [P.LOAN_READ] },
  { href: "/admin/reports", label: "Reports", section: "Overview", icon: BarChart3, anyOf: [P.LOAN_READ] },
  { href: "/admin/onboarding", label: "Onboarding", section: "Overview", icon: ScanFace, anyOf: [P.LOAN_READ] },

  { href: "/admin/loan-applications", label: "Applications", section: "Lending", icon: FileText, anyOf: [P.LOAN_READ] },
  { href: "/admin/loans", label: "Loan book", section: "Lending", icon: HandCoins, anyOf: [P.LOAN_READ] },
  { href: "/admin/loan-products", label: "Loan products", section: "Lending", icon: Package, anyOf: [P.LOAN_READ] },

  { href: "/admin/customers", label: "Customers", section: "Customers & money", icon: Users, anyOf: [P.LOAN_READ] },
  { href: "/admin/transactions", label: "Transactions", section: "Customers & money", icon: ArrowLeftRight, anyOf: [P.PAYMENT_READ] },
  { href: "/admin/savings", label: "Savings", section: "Customers & money", icon: PiggyBank, anyOf: [], soon: true },
  { href: "/admin/group-thrift", label: "Group thrift", section: "Customers & money", icon: UsersRound, anyOf: [], soon: true },

  { href: "/admin/staff", label: "Staff & roles", section: "Administration", icon: Shield, anyOf: [P.STAFF_READ, P.ROLE_READ] },
  { href: "/admin/audit", label: "Audit log", section: "Administration", icon: ClipboardList, anyOf: [P.LOAN_READ] },
  { href: "/admin/notifications", label: "Notifications", section: "Administration", icon: Bell, anyOf: [], soon: true },
  { href: "/admin/settings", label: "Settings", section: "Administration", icon: Settings, anyOf: [P.LOAN_READ] },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
}

/** Breadcrumb trail for the current path, e.g. Lending › Applications › Details. */
export function breadcrumbs(pathname: string): { label: string; href?: string }[] {
  const item = [...NAV_ITEMS].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(pathname, i.href));
  if (!item) return [{ label: "Dashboard" }];
  const trail: { label: string; href?: string }[] = [{ label: item.section }];
  const isDetail = pathname !== item.href;
  trail.push({ label: item.label, href: isDetail ? item.href : undefined });
  if (isDetail) trail.push({ label: "Details" });
  return trail;
}
