"use client";

import { Download } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ShareBars } from "@/components/admin/ShareBars";
import { PageHeader, StatTile, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, InlineError, PageSkeleton, TableSkeleton } from "@/components/admin/States";
import { dashboardApi, loansApi, settingsApi } from "@/lib/admin/endpoints";
import { useAction, useResource } from "@/lib/admin/hooks";
import { money, moneyCompact } from "@/lib/admin/format";
import { statusLabel } from "@/components/ui/Badge";
import type { DemographicBucket } from "@/lib/admin/types";

export default function ReportsPage() {
  const dashboard = useResource(() => dashboardApi.get());
  const branches = useResource(() => settingsApi.branches());
  const overdue = useResource(() => loansApi.list({ status: "overdue", limit: 1 }));
  const active = useResource(() => loansApi.list({ status: "active", limit: 1 }));
  const exporter = useAction();

  if (dashboard.loading && !dashboard.data) return <PageSkeleton />;
  if (dashboard.error) return <ErrorState message={dashboard.error} onRetry={dashboard.reload} />;
  const d = dashboard.data!;

  const byStatus = [...d.status_counts].sort((a, b) => b.count - a.count).map((s) => ({ key: s.status, label: statusLabel(s.status), value: s.count }));
  const openLoans = (active.data?.total ?? 0) + (overdue.data?.total ?? 0);
  const overdueShare = openLoans ? ((overdue.data?.total ?? 0) / openLoans) * 100 : 0;
  const branchMax = Math.max(1, ...(branches.data ?? []).map((b) => b.customer_count));

  return (
    <>
      <PageHeader
        title="Reports"
        description="Lending pipeline, portfolio health and applicant demographics."
        actions={
          <Button variant="outline" loading={exporter.busy} onClick={() => exporter.run(() => dashboardApi.exportDemographics())}>
            {!exporter.busy && <Download className="h-4 w-4" />} Export demographics (CSV)
          </Button>
        }
      />
      {exporter.error && (
        <div className="mb-4">
          <InlineError message={exporter.error} />
        </div>
      )}

      <section aria-label="Headline figures" className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Applications" value={d.total_applications} hint={`${d.demographics.total_applicants} unique applicants`} />
        <StatTile label="Total disbursed" value={d.total_disbursed_amount} format={moneyCompact} hint={money(d.total_disbursed_amount)} />
        <StatTile label="Open loans" value={openLoans} loading={active.loading && !active.data} hint="Active and overdue" />
        <StatTile
          label="Loans overdue (by count)"
          value={`${overdueShare.toFixed(1)}%`}
          loading={overdue.loading && !overdue.data}
          tone={overdueShare > 0 ? "error" : "success"}
          hint={`${overdue.data?.total ?? 0} of ${openLoans} open loans overdue`}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Applications by status" description="Every application, including drafts" />
          {byStatus.length === 0 ? <Empty title="No applications yet" compact /> : <ShareBars items={byStatus} />}
        </Card>
        <Card>
          <CardHeader title="Product mix" description="Share of all applications" />
          {d.product_mix.length === 0 ? (
            <Empty title="No applications yet" compact />
          ) : (
            <ShareBars
              max={100}
              valueFormat={(v) => `${v}%`}
              items={d.product_mix.map((p) => ({ key: p.product_code, label: p.product_name, value: p.percentage, sub: `${p.count}` }))}
            />
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-2xs font-semibold uppercase tracking-wider text-ink-3">Applicant demographics</h2>
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <BucketCard title="Gender" buckets={d.demographics.gender} />
        <BucketCard title="Age" buckets={d.demographics.age_buckets} />
        <BucketCard title="State of residence" buckets={d.demographics.state_of_residence.slice(0, 8)} more={d.demographics.state_of_residence.length - 8} />
      </div>

      <Card flush className="mt-6">
        <div className="px-5 pt-5">
          <CardHeader title="Customers by branch" />
        </div>
        {branches.loading && !branches.data ? (
          <TableSkeleton cols={3} rows={3} />
        ) : (branches.data ?? []).length === 0 ? (
          <Empty title="No customers yet" compact />
        ) : (
          <TableShell>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Branch</th>
                  <th className="w-1/2">Share</th>
                  <th className="num">Customers</th>
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {branches.data!.map((b) => (
                  <tr key={b.name}>
                    <td className="font-medium text-ink">{b.name}</td>
                    <td>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden>
                        <div className="h-full rounded-full bg-navy" style={{ width: `${(b.customer_count / branchMax) * 100}%` }} />
                      </div>
                    </td>
                    <td className="num font-semibold text-ink">{b.customer_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </Card>
    </>
  );
}

function BucketCard({ title, buckets, more = 0 }: { title: string; buckets: DemographicBucket[]; more?: number }) {
  return (
    <Card>
      <CardHeader title={title} description={more > 0 ? `Top 8 · ${more} more in the CSV export` : undefined} />
      {buckets.length === 0 ? (
        <Empty title="No data yet" compact />
      ) : (
        <ShareBars
          max={100}
          valueFormat={(v) => `${v}%`}
          items={buckets.map((b) => ({ key: b.label, label: b.label, value: b.percentage, sub: `${b.count}` }))}
        />
      )}
    </Card>
  );
}
