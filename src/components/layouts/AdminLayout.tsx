"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Clock, FileText, LogOut, Menu, Search, X,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { P, useStaffAuth } from "@/lib/admin/auth";
import { applicationsApi } from "@/lib/admin/endpoints";
import { Initials } from "@/components/admin/Page";
import { CommandPalette } from "@/components/admin/CommandPalette";
import { IdleWarning } from "@/components/admin/IdleWarning";
import { NAV_ITEMS, NAV_SECTIONS, breadcrumbs, isActive } from "./navigation";
import { routeRendered, transitionTo, usePresence } from "@/lib/admin/motion";

const COLLAPSE_KEY = "ghtrust_sidebar_collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { staff, can, signOut } = useStaffAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawer = usePresence(drawerOpen, 180);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const firstRender = useRef(true);

  const visible = NAV_ITEMS.filter((item) => item.anyOf.length === 0 || item.anyOf.some((p) => can(p)));
  const roleLabel = staff?.is_super_admin ? "Super admin" : staff?.role?.name ?? "No role assigned";
  const crumbs = breadcrumbs(pathname);

  useEffect(() => setCollapsed(readCollapsed()), []);

  const toggleCollapsed = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* storage unavailable — keep the in-memory state */
      }
      return !c;
    });

  // Review-queue count; refreshed on navigation (e.g. after acting on an application).
  useEffect(() => {
    if (!can(P.LOAN_READ)) return;
    applicationsApi
      .list({ status: "under_review", limit: 1 })
      .then((r) => setPendingCount(r.total))
      .catch(() => setPendingCount(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // The new route is on screen: let the cross-fade play.
  useEffect(() => {
    routeRendered();
  }, [pathname]);

  // Internal links animate between pages (View Transitions). Plain clicks only —
  // new-tab/modified clicks and downloads behave normally.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !url.pathname.startsWith("/admin")) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      const href = url.pathname + url.search + url.hash;
      transitionTo(() => router.push(href));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);

  // Close the drawer and move focus to the new page for keyboard/screen-reader users.
  useEffect(() => {
    setDrawerOpen(false);
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  // Global shortcuts: Ctrl/⌘+K anywhere, "/" when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "Escape") {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    router.replace("/admin/login");
  }, [signOut, router]);

  const shortcuts = [
    ...(can(P.LOAN_READ)
      ? [
          { label: "Applications awaiting review", href: "/admin/loan-applications?status=under_review", icon: Clock },
          { label: "Approved — ready to disburse", href: "/admin/loan-applications?status=approved", icon: FileText },
          { label: "Overdue loans", href: "/admin/loans?status=overdue", icon: AlertTriangle },
        ]
      : []),
    ...(can(P.PAYMENT_READ) ? [{ label: "Pending transactions", href: "/admin/transactions?status=pending", icon: Clock }] : []),
  ];

  const sidebar = (mobile: boolean) => {
    const rail = collapsed && !mobile;
    return (
      <div className="flex h-full flex-col">
        <div className={cn("flex h-14 shrink-0 items-center gap-2.5 border-b border-white/[0.08]", rail ? "justify-center px-2" : "px-4")}>
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5 rounded-md" aria-label="GH Trust staff portal home">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-[13px] font-bold tracking-tight text-navy">
              GH
            </span>
            {!rail && (
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-sm font-semibold text-white">GH Trust</span>
                <span className="block truncate text-2xs font-medium uppercase tracking-wider text-white/60">Staff portal</span>
              </span>
            )}
          </Link>
          {mobile && (
            <button
              onClick={() => setDrawerOpen(false)}
              className="ml-auto rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <nav aria-label="Main" className={cn("scrollbar-thin flex-1 overflow-y-auto py-3", rail ? "px-2" : "px-3")}>
          {NAV_SECTIONS.map((section) => {
            const items = visible.filter((i) => i.section === section);
            if (items.length === 0) return null;
            return (
              <div key={section} className="mb-4 last:mb-0">
                {rail ? (
                  <div className="mx-2 mb-2 border-t border-white/[0.08] first:hidden" />
                ) : (
                  <p className="mb-1 px-2.5 text-2xs font-semibold uppercase tracking-wider text-white/55">{section}</p>
                )}
                <ul className="space-y-0.5">
                  {items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const badge = item.href === "/admin/loan-applications" && !!pendingCount ? pendingCount : null;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          title={rail ? item.label : undefined}
                          aria-label={rail ? `${item.label}${badge ? `, ${badge} awaiting review` : ""}` : undefined}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-lg text-[13px] font-medium transition-colors",
                            rail ? "h-9 justify-center" : "h-9 px-2.5",
                            active ? "bg-white/[0.09] text-white" : "text-white/65 hover:bg-white/[0.05] hover:text-white",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute inset-y-2 left-0 w-0.5 origin-center rounded-full bg-cyan-bright shadow-[0_0_10px_rgba(47,164,215,0.7)] transition-transform duration-300 ease-out",
                              active ? "scale-y-100" : "scale-y-0",
                            )}
                            aria-hidden
                          />
                          <item.icon className={cn("h-[18px] w-[18px] shrink-0", active ? "text-cyan-bright" : "text-white/55 group-hover:text-white/80")} />
                          {!rail && <span className="flex-1 truncate">{item.label}</span>}
                          {!rail && badge && (
                            <span className="num rounded-full bg-cyan-bright px-1.5 py-px text-2xs font-bold text-navy-900">{badge}</span>
                          )}
                          {!rail && item.soon && (
                            <span className="rounded border border-white/20 px-1 text-[10px] font-medium uppercase tracking-wide text-white/60">Soon</span>
                          )}
                          {rail && badge && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-cyan-bright" aria-hidden />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {!mobile && (
          <div className={cn("shrink-0 border-t border-white/[0.08] p-2", rail && "flex justify-center")}>
            <button
              onClick={toggleCollapsed}
              className={cn(
                "flex h-9 items-center gap-3 rounded-lg px-2.5 text-[13px] font-medium text-white/55 transition-colors hover:bg-white/[0.05] hover:text-white",
                rail ? "w-9 justify-center px-0" : "w-full",
              )}
              aria-label={rail ? "Expand sidebar" : "Collapse sidebar"}
              title={rail ? "Expand sidebar" : undefined}
            >
              {rail ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
              {!rail && "Collapse"}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-canvas">
      <a
        href="#main"
        className="sr-only z-[80] rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden bg-surface-sidebar transition-[width] duration-200 lg:block",
          collapsed ? "w-[68px]" : "w-[248px]",
        )}
      >
        {sidebar(false)}
      </aside>

      {/* Mobile / tablet drawer */}
      {drawer.mounted && (
        <div className={cn("fixed inset-0 z-50 lg:hidden", drawer.closing && "pointer-events-none")} role="dialog" aria-modal="true" aria-label="Navigation">
          <div className={cn("absolute inset-0 bg-ink/50", drawer.closing ? "animate-fade-out" : "animate-fade-in")} onClick={() => setDrawerOpen(false)} aria-hidden />
          <aside
            className={cn(
              "absolute inset-y-0 left-0 w-[272px] bg-surface-sidebar shadow-pop",
              drawer.closing ? "animate-slide-out-left" : "animate-slide-in-left",
            )}
          >
            {sidebar(true)}
          </aside>
        </div>
      )}

      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-[248px]")}>
        <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto flex h-14 max-w-[1600px] 3xl:max-w-[1920px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              className="-ml-1.5 rounded-md p-1.5 text-ink-2 hover:bg-gray-100 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <nav aria-label="Breadcrumb" className="hidden min-w-0 md:block">
              <ol className="flex items-center gap-1.5 text-[13px]">
                {crumbs.map((c, i) => (
                  <Fragment key={`${c.label}-${i}`}>
                    {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden />}
                    <li className="truncate">
                      {c.href ? (
                        <Link href={c.href} className="text-ink-3 hover:text-ink">
                          {c.label}
                        </Link>
                      ) : (
                        <span className={i === crumbs.length - 1 ? "font-medium text-ink" : "text-ink-3"} aria-current={i === crumbs.length - 1 ? "page" : undefined}>
                          {c.label}
                        </span>
                      )}
                    </li>
                  </Fragment>
                ))}
              </ol>
            </nav>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setPaletteOpen(true)}
                className="flex h-9 items-center gap-2 rounded-lg border border-line bg-gray-50 px-3 text-[13px] text-ink-3 transition-colors hover:border-line-strong hover:bg-white sm:w-64 xl:w-80"
                aria-label="Search or jump to (Ctrl K)"
              >
                <Search className="h-4 w-4 shrink-0" />
                <span className="hidden flex-1 truncate text-left sm:block">Search customers or jump to…</span>
                <kbd className="hidden rounded border border-line bg-white px-1.5 font-sans text-2xs font-medium sm:block">Ctrl K</kbd>
              </button>

              {pendingCount !== null && pendingCount > 0 && (
                <Link
                  href="/admin/loan-applications?status=under_review"
                  className="hidden h-9 items-center gap-2 rounded-lg border border-cyan/25 bg-cyan-soft px-3 text-[13px] font-medium text-cyan transition-colors hover:border-cyan/50 md:flex"
                >
                  <Clock className="h-4 w-4" />
                  <span className="num">{pendingCount}</span> to review
                </Link>
              )}

              <UserMenu name={staff?.full_name ?? "—"} email={staff?.email} role={roleLabel} onSignOut={handleSignOut} />
            </div>
          </div>
        </header>

        <main
          id="main"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-[1600px] px-4 py-6 3xl:max-w-[1920px] outline-none sm:px-6 lg:px-8 lg:py-8"
        >
          <div key={pathname} className="page-surface page-enter animate-rise-in">
            {children}
          </div>
        </main>
      </div>

      <IdleWarning />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={visible}
        shortcuts={shortcuts}
        canSearchCustomers={can(P.LOAN_READ)}
      />
    </div>
  );
}

function UserMenu({ name, email, role, onSignOut }: { name: string; email?: string; role: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const menu = usePresence(open, 120);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-9 items-center gap-2.5 rounded-lg pl-1 pr-1.5 transition-colors hover:bg-gray-100 sm:pr-2"
      >
        <Initials name={name} />
        <span className="hidden text-left leading-tight xl:block">
          <span className="block max-w-[160px] truncate text-[13px] font-semibold text-ink">{name}</span>
          <span className="block max-w-[160px] truncate text-2xs text-ink-3">{role}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-ink-3 sm:block" />
      </button>
      {menu.mounted && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-11 z-50 w-64 origin-top-right rounded-xl border border-line bg-white p-1.5 shadow-pop",
            menu.closing ? "animate-scale-out" : "animate-scale-in",
          )}
        >
          <div className="border-b border-line px-3 pb-2.5 pt-1.5">
            <p className="truncate text-sm font-semibold text-ink">{name}</p>
            {email && <p className="truncate text-xs text-ink-3">{email}</p>}
            <p className="mt-1.5 inline-block rounded bg-navy/[0.06] px-1.5 py-0.5 text-2xs font-semibold text-navy">{role}</p>
          </div>
          <button
            role="menuitem"
            onClick={onSignOut}
            className="mt-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-error transition-colors hover:bg-error-soft"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
