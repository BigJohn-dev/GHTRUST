"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge, statusLabel } from "@/components/ui/Badge";
import { FilterTabs, PageHeader, SearchInput, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, PageSkeleton, Pager, TableSkeleton } from "@/components/admin/States";
import { applicationsApi, dashboardApi } from "@/lib/admin/endpoints";
import { useDebouncedValue, useResource } from "@/lib/admin/hooks";
import { date, money, relativeTime } from "@/lib/admin/format";
import { downloadCsv } from "@/lib/admin/csv";
import type { ApplicationSummary } from "@/lib/admin/types";
import { useTransitionRouter } from "@/lib/admin/motion";

const PAGE = 50;
const FILTERS = [
  { value: "all", label: "All" },
  { value: "under_review", label: "Under review" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "ready_to_disburse", label: "Disbursing" },
  { value: "disbursed", label: "Disbursed" },
  { value: "rejected", label: "Rejected" },
  { value: "draft", label: "Drafts" },
];

function ApplicationsQueue() {
  const router = useTransitionRouter();
  const params = useSearchParams();
  const status = params.get("status") ?? "all";
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("");
  const search = useDebouncedValue(filter.trim(), 300);
  useEffect(() => setOffset(0), [search]);

  const counts = useResource(() => dashboardApi.get(), []);
  const list = useResource(
    () => applicationsApi.list({ status, search: search || undefined, limit: PAGE, offset }),
    [status, search, offset],
  );

  const setStatus = (value: string) => {
    setOffset(0);
    router.replace(value === "all" ? "/admin/loan-applications" : `/admin/loan-applications?status=${value}`, { scroll: false });
  };
  const countFor = (value: string) =>
    value === "all" ? counts.data?.total_applications : counts.data?.status_counts.find((s) => s.status === value)?.count ?? 0;

  const rows = list.data?.items ?? [];

  function exportRows() {
    downloadCsv<ApplicationSummary>(`applications-${status}`, rows, [
      { header: "Applicant", value: (a) => a.applicant_name },
      { header: "Account", value: (a) => a.account_number },
      { header: "Branch", value: (a) => a.branch },
      { header: "Product", value: (a) => a.product_name },
      { header: "Requested (NGN)", value: (a) => a.requested_amount },
      { header: "Approved (NGN)", value: (a) => a.approved_amount },
      { header: "Stage", value: (a) => a.current_stage_name },
      { header: "Approver", value: (a) => a.approver_role_name },
      { header: "Submitted", value: (a) => a.submitted_at ?? a.created_at },
      { header: "Status", value: (a) => statusLabel(a.status) },
    ]);
  }

  return (
    <>
      <PageHeader
        title="Loan applications"
        description="Open an application to verify documents, act on your workflow stage and disburse."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={rows.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card flush>
        <div className="border-b border-line px-4 pt-1">
          <FilterTabs
            label="Application status"
            value={status}
            onChange={setStatus}
            options={FILTERS.map((f) => ({ ...f, count: countFor(f.value) }))}
          />
        </div>
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <SearchInput
            value={filter}
            onChange={setFilter}
            placeholder="Search applicant name, phone or account"
            aria-label="Search applications"
            containerClassName="w-full sm:max-w-xs"
          />
        </div>

        {list.loading && !list.data ? (
          <TableSkeleton cols={7} />
        ) : list.error ? (
          <div className="p-5">
            <ErrorState message={list.error} onRetry={list.reload} />
          </div>
        ) : rows.length === 0 ? (
          <Empty
            title={search ? `No applications match “${search}”` : "No applications"}
            hint={search ? "Try a phone number, account number or part of the name." : status === "all" ? undefined : `Nothing is ${statusLabel(status).toLowerCase()} right now.`}
          />
        ) : (
          <>
            <TableShell>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Product</th>
                    <th className="num">Requested</th>
                    <th className="num">Approved</th>
                    <th>Current stage</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th className="w-8" aria-label="Open" />
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {rows.map((a) => {
                    const href = `/admin/loan-applications/${a.id}`;
                    return (
                      <tr key={a.id} className="group cursor-pointer" onClick={() => router.push(href)} onMouseEnter={() => router.prefetch(href)}>
                        <td>
                          <Link href={href} className="font-medium text-ink group-hover:text-cyan" onClick={(e) => e.stopPropagation()}>
                            {a.applicant_name ?? "—"}
                          </Link>
                          <span className="num block text-xs text-ink-3">
                            {a.account_number ?? "—"} · {a.branch ?? "—"}
                          </span>
                        </td>
                        <td>{a.product_name}</td>
                        <td className="num font-medium text-ink">{money(a.requested_amount)}</td>
                        <td className="num">{money(a.approved_amount)}</td>
                        <td>
                          {a.current_stage_name ? (
                            <>
                              <span className="text-ink">{a.current_stage_name}</span>
                              <span className="block text-xs text-ink-3">{a.approver_role_name}</span>
                            </>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap">
                          <span title={date(a.submitted_at ?? a.created_at)}>{relativeTime(a.submitted_at ?? a.created_at)}</span>
                        </td>
                        <td>
                          <StatusBadge status={a.status} />
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

export default function LoanApplicationsPage() {
  return (
    <Suspense fallback={<PageSkeleton stats={false} />}>
      <ApplicationsQueue />
    </Suspense>
  );
}
