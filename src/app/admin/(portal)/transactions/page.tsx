"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Clock, Download, XCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, statusLabel } from "@/components/ui/Badge";
import { PageHeader, SelectFilter, StatTile, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, PageSkeleton, Pager, TableSkeleton } from "@/components/admin/States";
import { paymentsApi } from "@/lib/admin/endpoints";
import { useResource } from "@/lib/admin/hooks";
import { dateTime, humanize, money } from "@/lib/admin/format";
import { downloadCsv } from "@/lib/admin/csv";
import type { PaymentTransaction } from "@/lib/admin/types";
import { useTransitionRouter } from "@/lib/admin/motion";

const PAGE = 50;

function txType(t: PaymentTransaction) {
  return t.application_id ? "Loan disbursement" : t.withdrawal_id ? "Withdrawal" : t.direction === "inbound" ? "Wallet funding" : humanize(t.channel);
}

function Transactions() {
  const router = useTransitionRouter();
  const params = useSearchParams();
  const status = params.get("status") ?? "all";
  const direction = params.get("direction") ?? "all";
  const [offset, setOffset] = useState(0);
  const summary = useResource(() => paymentsApi.summary());
  const list = useResource(() => paymentsApi.transactions({ status, direction, limit: PAGE, offset }), [status, direction, offset]);
  const s = summary.data;
  const rows = list.data?.items ?? [];

  const setParam = (key: "status" | "direction", value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === "all") next.delete(key);
    else next.set(key, value);
    setOffset(0);
    const qs = next.toString();
    router.replace(qs ? `/admin/transactions?${qs}` : "/admin/transactions", { scroll: false });
  };

  function exportRows() {
    downloadCsv<PaymentTransaction>("transactions", rows, [
      { header: "Reference", value: (t) => t.provider_reference },
      { header: "Customer", value: (t) => t.customer_name },
      { header: "Type", value: txType },
      { header: "Direction", value: (t) => t.direction },
      { header: "Amount (NGN)", value: (t) => t.amount },
      { header: "Provider", value: (t) => t.provider },
      { header: "Date", value: (t) => t.created_at },
      { header: "Status", value: (t) => statusLabel(t.status) },
      { header: "Failure reason", value: (t) => t.failure_reason },
    ]);
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Money through the payment rail: wallet funding, withdrawals and loan disbursements. Pending items settle on provider callbacks or the reconciliation job (every 20 minutes)."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <section aria-label="Summary" className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Money in (completed)" value={money(s?.completed_inbound_amount)} loading={!s && summary.loading} icon={ArrowDownLeft} tone="success" href="/admin/transactions?direction=inbound&status=completed" />
        <StatTile label="Money out (completed)" value={money(s?.completed_outbound_amount)} loading={!s && summary.loading} icon={ArrowUpRight} href="/admin/transactions?direction=outbound&status=completed" />
        <StatTile
          label="Pending"
          value={s?.by_status.pending ?? 0}
          loading={!s && summary.loading}
          icon={Clock}
          tone={s?.by_status.pending ? "warning" : "default"}
          hint="Awaiting provider confirmation"
          href="/admin/transactions?status=pending"
        />
        <StatTile
          label="Failed / reversed"
          value={(s?.by_status.failed ?? 0) + (s?.by_status.reversed ?? 0)}
          loading={!s && summary.loading}
          icon={XCircle}
          tone={(s?.by_status.failed ?? 0) + (s?.by_status.reversed ?? 0) ? "error" : "default"}
          href="/admin/transactions?status=failed"
        />
      </section>

      <Card flush>
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h2 className="mr-auto text-[15px] font-semibold text-ink">Rail transactions</h2>
          <SelectFilter
            label="Direction"
            value={direction}
            onChange={(v) => setParam("direction", v)}
            options={[
              { value: "all", label: "In & out" },
              { value: "inbound", label: "Money in" },
              { value: "outbound", label: "Money out" },
            ]}
          />
          <SelectFilter
            label="Status"
            value={status}
            onChange={(v) => setParam("status", v)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "pending", label: "Pending" },
              { value: "completed", label: "Completed" },
              { value: "failed", label: "Failed" },
              { value: "reversed", label: "Reversed" },
            ]}
          />
        </div>

        {list.loading && !list.data ? (
          <TableSkeleton cols={7} />
        ) : list.error ? (
          <div className="p-5">
            <ErrorState message={list.error} onRetry={list.reload} />
          </div>
        ) : rows.length === 0 ? (
          <Empty title="No transactions" hint={status !== "all" || direction !== "all" ? "Try clearing the filters." : undefined} />
        ) : (
          <>
            <TableShell>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th className="num">Amount</th>
                    <th>Provider</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {rows.map((t) => (
                    <tr key={t.id}>
                      <td className="max-w-[220px] truncate font-mono text-xs text-ink" title={t.provider_reference}>
                        {t.provider_reference}
                      </td>
                      <td>
                        {t.customer_id ? (
                          <Link href={`/admin/customers/${t.customer_id}`} className="font-medium text-ink hover:text-cyan">
                            {t.customer_name ?? "Customer"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {t.application_id ? (
                          <Link href={`/admin/loan-applications/${t.application_id}`} className="hover:text-cyan">
                            {txType(t)}
                          </Link>
                        ) : (
                          txType(t)
                        )}
                      </td>
                      <td className={`num whitespace-nowrap font-semibold ${t.direction === "inbound" ? "text-success" : "text-ink"}`}>
                        <span aria-label={t.direction === "inbound" ? "in" : "out"}>{t.direction === "inbound" ? "+" : "−"}</span>
                        {money(t.amount, { decimals: true })}
                      </td>
                      <td>{humanize(t.provider)}</td>
                      <td className="whitespace-nowrap">{dateTime(t.created_at)}</td>
                      <td>
                        <StatusBadge status={t.status} />
                        {t.failure_reason && <p className="mt-1 max-w-[220px] whitespace-normal text-xs text-error">{t.failure_reason}</p>}
                      </td>
                    </tr>
                  ))}
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

export default function TransactionsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Transactions />
    </Suspense>
  );
}
