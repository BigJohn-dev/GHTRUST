"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, PiggyBank, HandCoins, TrendingUp, Users, ArrowLeftRight,
  Wallet, Bell, User, Menu, LogOut, Search, Sparkles,
} from "lucide-react";
import { useState } from "react";
import { LogoLink } from "../ui/Logo";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

const navItems = [
  { href: "/customer", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customer/savings", label: "Savings", icon: PiggyBank },
  { href: "/customer/loans", label: "Loans", icon: HandCoins },
  { href: "/customer/investments", label: "Investments", icon: TrendingUp },
  { href: "/customer/group-thrift", label: "Group Thrift", icon: Users },
  { href: "/customer/transactions", label: "Transactions", icon: ArrowLeftRight },
  { href: "/customer/wallet", label: "Wallet", icon: Wallet },
  { href: "/customer/notifications", label: "Notifications", icon: Bell },
  { href: "/customer/profile", label: "Profile", icon: User },
];

export function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadCount = useAppStore((s) => s.customerNotifications.filter((n) => !n.read).length);

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
          <LogoLink href="/customer" />
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/customer" && pathname.startsWith(item.href));
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
                {item.href === "/customer/notifications" && unreadCount > 0 && (
                  <span className="ml-auto bg-error text-white text-[10px] min-w-[18px] h-[18px] rounded-full flex items-center justify-center font-bold">
                    {unreadCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 space-y-3">
          <div className="rounded-2xl gradient-navy p-4 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-semibold">Premium Savings</span>
            </div>
            <p className="text-[11px] text-white/70 leading-relaxed">Unlock 15% fixed deposit rates with GH Trust Pro.</p>
            <button className="mt-3 w-full py-2 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors">
              Learn More
            </button>
          </div>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center text-white text-xs font-bold">AO</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy truncate">Adaeze Okafor</p>
              <p className="text-[11px] text-gray-400 truncate">Lagos Main</p>
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
                  placeholder="Search transactions, loans..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border-0 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/20"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Link href="/customer/notifications" className="relative p-2.5 rounded-xl hover:bg-surface transition-colors">
                <Bell className="w-5 h-5 text-gray-500" />
                {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-error rounded-full" />}
              </Link>
              <div className="hidden sm:block text-right mr-1">
                <p className="text-xs text-gray-400">Welcome back</p>
                <p className="text-sm font-semibold text-navy">Adaeze Okafor</p>
              </div>
              <div className="w-9 h-9 rounded-xl gradient-navy flex items-center justify-center text-white text-xs font-bold">AO</div>
            </div>
          </div>
        </header>
        <main className="p-6 max-w-[1400px]">{children}</main>
      </div>
    </div>
  );
}
