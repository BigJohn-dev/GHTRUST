"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, BarChart3, Clock, HandCoins, Landmark } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import dynamic from "next/dynamic";
import { ShareBars } from "@/components/admin/ShareBars";
import { Initials, PageHeader, StatTile, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, PageSkeleton, Skeleton } from "@/components/admin/States";
import { useStaffAuth } from "@/lib/admin/auth";
import { dashboardApi, loansApi } from "@/lib/admin/endpoints";
import { useResource } from "@/lib/admin/hooks";
import { date, money, moneyCompact, relativeTime } from "@/lib/admin/format";

// Recharts is the heaviest dependency; load it after the page is interactive.
const ColumnChart = dynamic(() => import("@/components/admin/Charts").then((m) => m.ColumnChart), {
  ssr: false,
  loading: () => <Skeleton className="h-[240px] w-full rounded-lg" />,
});

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function AdminDashboard() {
  const { staff } = useStaffAuth();
  const dashboard = useResource(() => dashboardApi.get());
  const overdue = useResource(() => loansApi.list({ status: "overdue", limit: 1 }));
  const open = useResource(() => loansApi.list({ status: "active", limit: 1 }));

  if (dashboard.loading && !dashboard.data) return <PageSkeleton />;
  if (dashboard.error) return <ErrorState message={dashboard.error} onRetry={dashboard.reload} />;
  const d = dashboard.data!;

  const count = (status: string) => d.status_counts.find((s) => s.status === status)?.count ?? 0;
  const pipeline = [
    { key: "submitted", label: "Submitted", value: count("submitted") },
    { key: "under_review", label: "Under review", value: count("under_review") },
    { key: "approved", label: "Approved, awaiting payout", value: count("approved") + count("ready_to_disburse") },
    { key: "disbursed", label: "Disbursed", value: count("disbursed") },
    { key: "rejected", label: "Rejected", value: count("rejected"), tone: "#98A2B3" },
  ];
  const daily = d.daily_submissions.map((s) => ({
    day: new Date(s.date).toLocaleDateString("en-NG", { weekday: "short", day: "numeric" }),
    count: s.count,
  }));
  const weekTotal = d.daily_submissions.reduce((s, x) => s + x.count, 0);
  const firstName = staff?.full_name.split(" ")[0] ?? "there";
  const overdueCount = overdue.data?.total;
  const openLoans = (open.data?.total ?? 0) + (overdueCount ?? 0);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          <>
            {new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {" · "}
            {d.pending_review_count === 0
              ? "The review queue is clear."
              : `${d.pending_review_count} application${d.pending_review_count === 1 ? "" : "s"} waiting for a decision.`}
          </>
        }
        actions={
          <>
            <ButtonLink href="/admin/reports" variant="outline">
              <BarChart3 className="h-4 w-4" /> Reports
            </ButtonLink>
            <ButtonLink href="/admin/loan-applications?status=under_review">
              Open review queue <ArrowRight className="h-4 w-4" />
            </ButtonLink>
          </>
        }
      />

      <section aria-label="Key figures" className="stagger grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          emphasis
          label="Total disbursed"
          value={d.total_disbursed_amount}
          format={moneyCompact}
          hint={money(d.total_disbursed_amount)}
          icon={HandCoins}
        />
        <StatTile
          label="Loan book"
          value={d.loan_book_amount}
          format={moneyCompact}
          hint={`Principal outstanding · ${openLoans} open loan${openLoans === 1 ? "" : "s"}`}
          icon={Landmark}
          href="/admin/loans"
        />
        <StatTile
          label="Awaiting review"
          value={d.pending_review_count}
          hint={`${d.total_applications} applications in total`}
          icon={Clock}
          tone={d.pending_review_count > 0 ? "info" : "default"}
          href="/admin/loan-applications?status=under_review"
        />
        <StatTile
          label="Overdue loans"
          value={overdueCount ?? "—"}
          loading={overdue.loading && !overdue.data}
          hint={overdueCount ? "Follow up with borrowers" : "No missed installments"}
          icon={AlertTriangle}
          tone={overdueCount ? "error" : "default"}
          href="/admin/loans?status=overdue"
        />
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card flush className="xl:col-span-2">
          <div className="px-5 pt-5">
            <CardHeader
              title="Review queue"
              description="Most recent submissions waiting for a decision"
              actions={
                <Link href="/admin/loan-applications?status=under_review" className="link text-[13px]">
                  View all
                </Link>
              }
            />
          </div>
          {d.pending_queue.length === 0 ? (
            <Empty title="Nothing waiting for review" hint="New submissions from the mobile app appear here." compact />
          ) : (
            <TableShell>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Product</th>
                    <th className="num">Amount</th>
                    <th>Stage</th>
                    <th>Waiting</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {d.pending_queue.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/loan-applications/${a.id}`} className="flex items-center gap-2.5 font-medium text-ink hover:text-cyan">
                          <Initials name={a.applicant_name} size="sm" />
                          {a.applicant_name ?? "Unknown applicant"}
                        </Link>
                      </td>
                      <td>{a.product_name}</td>
                      <td className="num font-medium text-ink">{money(a.requested_amount)}</td>
                      <td>
                        <span className="text-ink">{a.current_stage_name ?? "—"}</span>
                        {a.approver_role_name && <span className="block text-xs text-ink-3">{a.approver_role_name}</span>}
                      </td>
                      <td className="whitespace-nowrap text-ink-3">{relativeTime(a.submitted_at ?? a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          )}
        </Card>

        <Card>
          <CardHeader title="Application pipeline" description={`${d.total_applications} applications in total`} />
          <ShareBars items={pipeline} />
          <div className="mt-5 border-t border-line pt-4 text-[13px]">
            <Link href="/admin/loan-applications" className="link inline-flex items-center gap-1">
              All applications <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Submissions, last 7 days"
            description={`${weekTotal} application${weekTotal === 1 ? "" : "s"} submitted this week`}
          />
          <ColumnChart
            data={daily}
            x="day"
            y="count"
            unit="applications"
            ariaLabel={`Applications submitted per day over the last 7 days: ${daily.map((x) => `${x.day} ${x.count}`).join(", ")}`}
          />
        </Card>

        <Card>
          <CardHeader title="Product mix" description="Share of all applications" />
          {d.product_mix.length === 0 ? (
            <Empty title="No applications yet" compact />
          ) : (
            <ShareBars
              max={100}
              items={d.product_mix.map((p) => ({
                key: p.product_code,
                label: p.product_name,
                value: p.percentage,
                sub: `${p.count}`,
              }))}
              valueFormat={(v) => `${v}%`}
            />
          )}
        </Card>
      </div>

      <Card flush className="mt-6">
          <div className="px-5 pt-5">
            <CardHeader title="Recent applications" description="Latest activity across every status" />
          </div>
          {d.recent_applications.length === 0 ? (
            <Empty title="No applications yet" hint="Applications appear here as customers submit them from the app." compact />
          ) : (
            <TableShell>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Applicant</th>
                    <th>Product</th>
                    <th className="num">Amount</th>
                    <th>Stage</th>
                    <th>Submitted</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {d.recent_applications.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/admin/loan-applications/${a.id}`} className="font-medium text-ink hover:text-cyan">
                          {a.applicant_name ?? "—"}
                        </Link>
                      </td>
                      <td>{a.product_name}</td>
                      <td className="num font-medium text-ink">{money(a.approved_amount ?? a.requested_amount)}</td>
                      <td>{a.current_stage_name ?? "—"}</td>
                      <td className="whitespace-nowrap">{date(a.submitted_at ?? a.created_at)}</td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
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
