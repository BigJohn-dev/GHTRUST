"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, FileText, HandCoins, PiggyBank, UsersRound,
  ArrowLeftRight, BarChart3, Bell, Shield, ClipboardList, Menu, LogOut, Search,
} from "lucide-react";
import { useState } from "react";
import { LogoLink } from "../ui/Logo";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/loan-applications", label: "Applications", icon: FileText },
  { href: "/admin/loans", label: "Loans", icon: HandCoins },
  { href: "/admin/savings", label: "Savings", icon: PiggyBank },
  { href: "/admin/group-thrift", label: "Group Thrift", icon: UsersRound },
  { href: "/admin/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/staff", label: "Staff", icon: Shield },
  { href: "/admin/audit", label: "Audit Log", icon: ClipboardList },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadCount = useAppStore((s) => s.adminNotifications.filter((n) => !n.read).length);
  const pendingCount = useAppStore((s) => s.loanApplications.filter((a) => a.status === "pending" || a.status === "under_review").length);

  return (
    <div className="min-h-screen bg-surface">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-navy/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={cn(
        "fixed top-0 left-0 z-50 h-full w-[260px] bg-surface-sidebar border-r border-navy/5 transition-transform lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-5">
          <LogoLink href="/admin" />
          <p className="text-[10px] text-gray-400 mt-1 font-medium tracking-wide uppercase">Admin Portal</p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-white text-navy shadow-card"
                    : "text-gray-500 hover:bg-white/60 hover:text-navy"
                )}
              >
                <item.icon className={cn("w-[18px] h-[18px]", isActive ? "text-cyan" : "")} />
                {item.label}
                {item.href === "/admin/loan-applications" && pendingCount > 0 && (
                  <span className="ml-auto bg-warning text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">
                    {pendingCount}
                  </span>
                )}
                {item.href === "/admin/notifications" && unreadCount > 0 && (
                  <span className="ml-auto bg-error text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 space-y-3">
          <div className="rounded-2xl bg-navy p-4 text-white">
            <p className="text-xs font-semibold">Branch: Lagos Main</p>
            <p className="text-[11px] text-white/60 mt-1">4 applications pending review</p>
            <Link href="/admin/loan-applications" className="mt-3 block w-full py-2 bg-cyan hover:bg-cyan/90 rounded-lg text-xs font-semibold text-center transition-colors">
              Review Now
            </Link>
          </div>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-xl bg-cyan flex items-center justify-center text-white text-xs font-bold">NO</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy truncate">Ngozi Okonkwo</p>
              <p className="text-[11px] text-gray-400 truncate">Branch Manager</p>
            </div>
          </div>
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-400 hover:text-navy hover:bg-white/60 transition-colors">
            <LogOut className="w-4 h-4" /> Exit Portal
          </Link>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-navy/5 px-6 py-3">
          <div className="flex items-center gap-4">
            <button className="lg:hidden p-2 rounded-xl hover:bg-surface" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5 text-navy" />
            </button>

            <div className="hidden md:flex flex-1 max-w-md mx-auto">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers, loans..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border-0 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Link href="/admin/notifications" className="relative p-2.5 rounded-xl hover:bg-surface transition-colors">
                <Bell className="w-5 h-5 text-gray-500" />
                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />}
              </Link>
              <div className="hidden sm:block text-right mr-1">
                <p className="text-xs text-gray-400">GH Trust Admin</p>
                <p className="text-sm font-semibold text-navy">Ngozi Okonkwo</p>
              </div>
              <div className="w-9 h-9 rounded-xl bg-cyan flex items-center justify-center text-white text-xs font-bold">NO</div>
            </div>
          </div>
        </header>
        <main className="p-6 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
