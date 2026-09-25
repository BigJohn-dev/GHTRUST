"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, CornerDownLeft, Search, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePresence, useTransitionRouter } from "@/lib/admin/motion";
import { customersApi } from "@/lib/admin/endpoints";
import type { CustomerSummary } from "@/lib/admin/types";
import type { NavItem } from "@/components/layouts/navigation";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

/**
 * Ctrl/⌘+K (or "/") palette: jump to any screen, open a filtered queue, or find a
 * customer by name, phone, account or BVN — without touching the mouse.
 */
export function CommandPalette({
  open,
  onClose,
  items,
  shortcuts,
  canSearchCustomers,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  shortcuts: { label: string; href: string; icon: NavItem["icon"] }[];
  canSearchCustomers: boolean;
}) {
  const router = useTransitionRouter();
  const { mounted, closing } = usePresence(open, 120);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setActive(0);
    setCustomers([]);
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Debounced customer lookup.
  useEffect(() => {
    const term = q.trim();
    if (!open || !canSearchCustomers || term.length < 2) {
      setCustomers([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const t = setTimeout(() => {
      customersApi
        .list({ search: term, limit: 6 })
        .then((rows) => !cancelled && setCustomers(rows))
        .catch(() => !cancelled && setCustomers([]))
        .finally(() => !cancelled && setSearching(false));
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, open, canSearchCustomers]);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const commands = useMemo<Command[]>(() => {
    const term = q.trim().toLowerCase();
    const match = (s: string) => !term || s.toLowerCase().includes(term);
    const nav = items
      .filter((i) => match(i.label) || match(i.section))
      .map<Command>((i) => ({
        id: `nav:${i.href}`,
        label: i.label,
        hint: i.section,
        group: "Go to",
        icon: i.icon,
        run: () => go(i.href),
      }));
    const quick = shortcuts
      .filter((s) => match(s.label))
      .map<Command>((s) => ({ id: `quick:${s.href}`, label: s.label, group: "Quick actions", icon: s.icon, run: () => go(s.href) }));
    const people = customers.map<Command>((c) => ({
      id: `cust:${c.id}`,
      label: c.full_name,
      hint: [c.account_number, c.phone].filter(Boolean).join(" · "),
      group: "Customers",
      icon: User,
      run: () => go(`/admin/customers/${c.id}`),
    }));
    const searchAll: Command[] =
      canSearchCustomers && term.length >= 2
        ? [{
            id: "cust:all",
            label: `Search all customers for “${q.trim()}”`,
            group: "Customers",
            icon: Search,
            run: () => go(`/admin/customers?search=${encodeURIComponent(q.trim())}`),
          }]
        : [];
    return [...people, ...searchAll, ...quick, ...nav];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, items, shortcuts, customers, canSearchCustomers]);

  useEffect(() => setActive(0), [q, customers.length]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  if (!mounted || typeof document === "undefined") return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, commands.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commands[active]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  let lastGroup = "";
  return createPortal(
    <div className={cn("fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh]", closing && "pointer-events-none")}>
      <div className={cn("absolute inset-0 bg-ink/40 backdrop-blur-[2px]", closing ? "animate-fade-out" : "animate-fade-in")} onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={cn(
          "relative w-full max-w-xl overflow-hidden rounded-xl border border-line bg-white shadow-pop",
          closing ? "animate-scale-out" : "animate-scale-in",
        )}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={canSearchCustomers ? "Jump to a page or find a customer…" : "Jump to a page…"}
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-gray-300"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={commands[active] ? `cmd-${active}` : undefined}
            aria-autocomplete="list"
          />
          {searching && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-cyan" aria-hidden />}
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 font-sans text-2xs text-ink-3 sm:block">Esc</kbd>
        </div>
        <div id="command-list" ref={listRef} role="listbox" className="scrollbar-thin max-h-[min(60vh,420px)] overflow-y-auto p-2">
          {commands.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-3">{searching ? "Searching…" : "No matches"}</p>
          ) : (
            commands.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null;
              lastGroup = c.group;
              return (
                <div key={c.id}>
                  {header && <p className="px-3 pb-1 pt-2.5 text-2xs font-semibold uppercase tracking-wider text-ink-3">{header}</p>}
                  <div
                    id={`cmd-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    onMouseMove={() => setActive(i)}
                    onClick={c.run}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm",
                      i === active ? "bg-navy text-white" : "text-ink-2",
                    )}
                  >
                    <c.icon className={cn("h-4 w-4 shrink-0", i === active ? "text-cyan-bright" : "text-ink-3")} />
                    <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
                    {c.hint && <span className={cn("truncate text-xs", i === active ? "text-white/70" : "text-ink-3")}>{c.hint}</span>}
                    {i === active ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-white/70" /> : <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-gray-50 px-4 py-2 text-2xs text-ink-3">
          <span><kbd className="font-sans font-semibold">↑↓</kbd> move</span>
          <span><kbd className="font-sans font-semibold">Enter</kbd> open</span>
          <span><kbd className="font-sans font-semibold">Ctrl K</kbd> toggle</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
