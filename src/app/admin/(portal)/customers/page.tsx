"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, statusLabel } from "@/components/ui/Badge";
import { Initials, PageHeader, SearchInput, SelectFilter, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, PageSkeleton, Pager, TableSkeleton } from "@/components/admin/States";
import { customersApi } from "@/lib/admin/endpoints";
import { prefetch } from "@/lib/admin/cache";
import { useResource } from "@/lib/admin/hooks";
import { date } from "@/lib/admin/format";
import { downloadCsv } from "@/lib/admin/csv";
import type { CustomerSummary } from "@/lib/admin/types";
import { useTransitionRouter } from "@/lib/admin/motion";

const PAGE = 50;
const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "pending_otp", label: "Pending OTP" },
  { value: "suspended", label: "Suspended" },
  { value: "inactive", label: "Inactive" },
];

function CustomerDirectory() {
  const router = useTransitionRouter();
  const params = useSearchParams();
  const urlSearch = params.get("search") ?? "";
  const [draft, setDraft] = useState(urlSearch);
  const [status, setStatus] = useState("all");
  const [offset, setOffset] = useState(0);

  // Follow outside URL changes (header search, back button) without clobbering what's being typed.
  useEffect(() => {
    setDraft((d) => (d.trim() === urlSearch ? d : urlSearch));
    setOffset(0);
  }, [urlSearch]);

  // Search as you type (debounced), keeping the URL shareable.
  useEffect(() => {
    const q = draft.trim();
    if (q === urlSearch) return;
    const t = setTimeout(() => router.replace(q ? `/admin/customers?search=${encodeURIComponent(q)}` : "/admin/customers", { scroll: false }), 350);
    return () => clearTimeout(t);
  }, [draft, urlSearch, router]);

  const list = useResource(
    () => customersApi.page({ search: urlSearch || undefined, status, limit: PAGE, offset }),
    [urlSearch, status, offset],
  );
  const rows = list.data?.items ?? [];

  function exportRows() {
    downloadCsv<CustomerSummary>("customers", rows, [
      { header: "Name", value: (c) => c.full_name },
      { header: "Email", value: (c) => c.email },
      { header: "Account", value: (c) => c.account_number },
      { header: "Phone", value: (c) => c.phone },
      { header: "Branch", value: (c) => c.branch },
      { header: "Applications", value: (c) => c.application_count },
      { header: "Joined", value: (c) => c.created_at },
      { header: "Status", value: (c) => statusLabel(c.status) },
    ]);
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="Registered through BVN verification in the mobile app."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card flush>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <form
            className="sm:flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              const q = draft.trim();
              router.replace(q ? `/admin/customers?search=${encodeURIComponent(q)}` : "/admin/customers", { scroll: false });
            }}
          >
            <SearchInput
              value={draft}
              onChange={setDraft}
              placeholder="Search by name, phone, email, account or BVN"
              aria-label="Search customers"
              containerClassName="sm:max-w-md"
            />
          </form>
          <SelectFilter
            label="Customer status"
            value={status}
            onChange={(v) => {
              setStatus(v);
              setOffset(0);
            }}
            options={STATUSES}
          />
        </div>

        {list.loading && !list.data ? (
          <TableSkeleton cols={7} />
        ) : list.error ? (
          <div className="p-5">
            <ErrorState message={list.error} onRetry={list.reload} />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={urlSearch ? `No customers match “${urlSearch}”` : "No customers yet"} hint={urlSearch ? "Try a phone number, account number or part of the name." : undefined} />
        ) : (
          <>
            <TableShell>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Account</th>
                    <th>Phone</th>
                    <th>Branch</th>
                    <th className="num">Applications</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th className="w-8" aria-label="Open" />
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {rows.map((c) => {
                    const href = `/admin/customers/${c.id}`;
                    return (
                      <tr
                        key={c.id}
                        className="group cursor-pointer"
                        onClick={() => router.push(href)}
                        onMouseEnter={() => {
                          prefetch(`customer:${c.id}`, () => customersApi.get(c.id));
                          router.prefetch(href);
                        }}
                      >
                        <td>
                          <div className="flex items-center gap-3">
                            <Initials name={c.full_name} />
                            <div className="min-w-0">
                              <Link href={href} className="font-medium text-ink group-hover:text-cyan" onClick={(e) => e.stopPropagation()}>
                                {c.full_name}
                              </Link>
                              <span className="block truncate text-xs text-ink-3">{c.email ?? "No email"}</span>
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-[13px] tabular-nums text-ink">{c.account_number}</td>
                        <td className="whitespace-nowrap tabular-nums">{c.phone}</td>
                        <td>{c.branch}</td>
                        <td className="num">{c.application_count}</td>
                        <td className="whitespace-nowrap">{date(c.created_at)}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="text-right">
                          <ChevronRight className="h-4 w-4 text-gray-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-3" aria-hidden />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
            <Pager total={list.data?.total} limit={PAGE} offset={offset} onChange={setOffset} />
          </>
        )}
      </Card>
    </>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<PageSkeleton stats={false} />}>
      <CustomerDirectory />
    </Suspense>
  );
}
