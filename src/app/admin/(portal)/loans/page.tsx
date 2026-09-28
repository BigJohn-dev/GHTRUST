"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronRight, Download, HandCoins, Landmark } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, statusLabel } from "@/components/ui/Badge";
import { FilterTabs, PageHeader, SearchInput, StatTile, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, PageSkeleton, Pager, TableSkeleton } from "@/components/admin/States";
import { dashboardApi, loansApi } from "@/lib/admin/endpoints";
import { prefetch } from "@/lib/admin/cache";
import { useDebouncedValue, useResource } from "@/lib/admin/hooks";
import { date, humanize, money, moneyCompact } from "@/lib/admin/format";
import { downloadCsv } from "@/lib/admin/csv";
import type { Loan } from "@/lib/admin/types";
import { useTransitionRouter } from "@/lib/admin/motion";

const PAGE = 50;
const FILTERS = [
  { value: "all", label: "All loans" },
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Fully repaid" },
  { value: "written_off", label: "Written off" },
];

function LoanBook() {
  const router = useTransitionRouter();
  const params = useSearchParams();
  const status = params.get("status") ?? "all";
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const search = useDebouncedValue(filter.trim(), 300);
  useEffect(() => setOffset(0), [search]);
  const list = useResource(
    () => loansApi.list({ status, search: search || undefined, limit: PAGE, offset }),
    [status, search, offset],
  );
  const active = useResource(() => loansApi.list({ status: "active", limit: 1 }));
  const overdue = useResource(() => loansApi.list({ status: "overdue", limit: 1 }));
  const completed = useResource(() => loansApi.list({ status: "completed", limit: 1 }));
  const writtenOff = useResource(() => loansApi.list({ status: "written_off", limit: 1 }));
  const book = useResource(() => dashboardApi.get());

  const setStatus = (value: string) => {
    setOffset(0);
    router.replace(value === "all" ? "/admin/loans" : `/admin/loans?status=${value}`, { scroll: false });
  };
  const counts: Record<string, number | undefined> = {
    active: active.data?.total,
    overdue: overdue.data?.total,
    completed: completed.data?.total,
    written_off: writtenOff.data?.total,
  };
  const allCount = Object.values(counts).every((c) => c !== undefined)
    ? Object.values(counts).reduce((s, c) => s! + c!, 0)
    : undefined;

  const rows = list.data?.items ?? [];

  function exportRows() {
    downloadCsv<Loan>(`loan-book-${status}`, rows, [
      { header: "Borrower", value: (l) => l.customer_name },
      { header: "Product", value: (l) => humanize(l.product_type) },
      { header: "Principal (NGN)", value: (l) => l.principal },
      { header: "Outstanding (NGN)", value: (l) => l.outstanding },
      { header: "Installment (NGN)", value: (l) => l.monthly_payment },
      { header: "Cadence", value: (l) => l.repayment_cadence },
      { header: "Rate % / month", value: (l) => l.interest_rate },
      { header: "Interest method", value: (l) => l.interest_method },
      { header: "Disbursed", value: (l) => l.disbursement_date },
      { header: "Next due", value: (l) => l.next_due_date },
      { header: "Status", value: (l) => statusLabel(l.status) },
    ]);
  }

  return (
    <>
      <PageHeader
        title="Loan book"
        description="Disbursed loans with their repayment schedules."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <section aria-label="Portfolio" className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Active loans" value={counts.active ?? "—"} loading={!active.data && active.loading} icon={HandCoins} href="/admin/loans?status=active" />
        <StatTile
          label="Overdue"
          value={counts.overdue ?? "—"}
          loading={!overdue.data && overdue.loading}
          icon={AlertTriangle}
          tone={counts.overdue ? "error" : "default"}
          hint={counts.overdue ? "Missed at least one installment" : "No missed installments"}
          href="/admin/loans?status=overdue"
        />
        <StatTile label="Fully repaid" value={counts.completed ?? "—"} loading={!completed.data && completed.loading} icon={CheckCircle2} tone="success" href="/admin/loans?status=completed" />
        <StatTile
          label="Principal outstanding"
          value={<span title={money(book.data?.loan_book_amount)}>{moneyCompact(book.data?.loan_book_amount)}</span>}
          loading={!book.data && book.loading}
          icon={Landmark}
          hint="Across all active and overdue loans"
        />
      </section>

      <Card flush>
        <div className="border-b border-line px-4 pt-1">
          <FilterTabs
            label="Loan status"
            value={status}
            onChange={setStatus}
            options={FILTERS.map((f) => ({ ...f, count: f.value === "all" ? allCount : counts[f.value] }))}
          />
        </div>
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <SearchInput
            value={filter}
            onChange={setFilter}
            placeholder="Search borrower name, phone or account"
            aria-label="Search loans"
            containerClassName="w-full sm:max-w-xs"
          />
        </div>

        {list.loading && !list.data ? (
          <TableSkeleton cols={8} />
        ) : list.error ? (
          <div className="p-5">
            <ErrorState message={list.error} onRetry={list.reload} />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={search ? `No loans match “${search}”` : "No loans"} hint={search ? "Try a phone number, account number or part of the name." : "Approve and disburse an application to book a loan."} />
        ) : (
          <>
            <TableShell>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Borrower</th>
                    <th className="num">Principal</th>
                    <th className="num">Outstanding</th>
                    <th className="num">Installment</th>
                    <th className="num">Rate / mo</th>
                    <th>Disbursed</th>
                    <th>Next due</th>
                    <th>Status</th>
                    <th className="w-8" aria-label="Open" />
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {rows.map((l) => {
                    const href = `/admin/loans/${l.id}`;
                    return (
                      <tr
                        key={l.id}
                        className="group cursor-pointer"
                        onClick={() => router.push(href)}
                        onMouseEnter={() => {
                          prefetch(`loan:${l.id}`, () => loansApi.get(l.id));
                          router.prefetch(href);
                        }}
                      >
                        <td>
                          <Link href={href} className="font-medium text-ink group-hover:text-cyan" onClick={(e) => e.stopPropagation()}>
                            {l.customer_name ?? "—"}
                          </Link>
                          <span className="block text-xs text-ink-3">{humanize(l.product_type)}</span>
                        </td>
                        <td className="num">{money(l.principal)}</td>
                        <td className={`num font-semibold ${l.status === "overdue" ? "text-error" : "text-ink"}`}>{money(l.outstanding)}</td>
                        <td className="num">
                          {money(l.monthly_payment)}
                          <span className="block text-xs text-ink-3">{humanize(l.repayment_cadence).toLowerCase()}</span>
                        </td>
                        <td className="num">
                          {Number(l.interest_rate)}%<span className="block text-xs text-ink-3">{humanize(l.interest_method).toLowerCase()}</span>
                        </td>
                        <td className="whitespace-nowrap">{date(l.disbursement_date)}</td>
                        <td className="whitespace-nowrap">{date(l.next_due_date)}</td>
                        <td>
                          <StatusBadge status={l.status} />
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

export default function LoanBookPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LoanBook />
    </Suspense>
  );
}
