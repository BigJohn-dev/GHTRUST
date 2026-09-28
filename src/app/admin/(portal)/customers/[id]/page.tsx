"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, ChevronRight } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { DescriptionList, Initials, PageHeader, StatTile } from "@/components/admin/Page";
import { Empty, ErrorState, PageSkeleton, Skeleton } from "@/components/admin/States";
import { customersApi, loansApi } from "@/lib/admin/endpoints";
import { useResource } from "@/lib/admin/hooks";
import { date, dateTime, humanize, money } from "@/lib/admin/format";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const customer = useResource(() => customersApi.get(id), [id], { key: `customer:${id}` });
  const loans = useResource(() => loansApi.list({ customer_id: id, limit: 100 }), [id]);

  if (customer.loading && !customer.data) return <PageSkeleton />;
  if (customer.error) return <ErrorState message={customer.error} onRetry={customer.reload} />;
  const c = customer.data!;
  const join = (...parts: (string | null | undefined)[]) => parts.filter(Boolean).join(" / ");

  return (
    <>
      <PageHeader
        back={{ href: "/admin/customers", label: "Customers" }}
        title={
          <span className="flex items-center gap-3">
            <Initials name={c.full_name} size="lg" className="hidden sm:flex" />
            {[c.title, c.full_name].filter(Boolean).join(" ")}
          </span>
        }
        meta={
          <>
            <StatusBadge status={c.status} />
            {c.phone_verified && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                <BadgeCheck className="h-3.5 w-3.5" /> Phone verified
              </span>
            )}
          </>
        }
        description={
          <>
            Account <span className="num font-mono text-ink-2">{c.account_number}</span> · {c.branch} · Joined {date(c.created_at)}
          </>
        }
      />

      <section aria-label="Summary" className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Applications" value={c.stats.total_applications} />
        <StatTile label="In progress" value={c.stats.active_applications} tone={c.stats.active_applications ? "info" : "default"} />
        <StatTile label="Loans disbursed" value={c.stats.disbursed_count} />
        <StatTile label="Total disbursed" value={money(c.stats.total_disbursed_amount)} />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card flush>
          <div className="px-5 pt-5">
            <CardHeader title="Loans" />
          </div>
          {loans.loading && !loans.data ? (
            <div className="space-y-3 px-5 pb-5">
              <Skeleton className="h-14" />
              <Skeleton className="h-14" />
            </div>
          ) : !loans.data || loans.data.items.length === 0 ? (
            <Empty title="No loans on the book" compact />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {loans.data.items.map((l) => (
                <li key={l.id}>
                  <Link href={`/admin/loans/${l.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink group-hover:text-cyan">{humanize(l.product_type)}</p>
                        <StatusBadge status={l.status} />
                      </div>
                      <p className="num mt-1 text-xs text-ink-3">
                        Principal {money(l.principal)} · Next due {date(l.next_due_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xs uppercase tracking-wide text-ink-3">Outstanding</p>
                      <p className={`num font-semibold ${l.status === "overdue" ? "text-error" : "text-ink"}`}>{money(l.outstanding)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card flush>
          <div className="px-5 pt-5">
            <CardHeader title="Applications" />
          </div>
          {c.loan_applications.length === 0 ? (
            <Empty title="No applications" compact />
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {c.loan_applications.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/loan-applications/${a.id}`} className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink group-hover:text-cyan">{a.product_name}</p>
                      <p className="num mt-0.5 text-xs text-ink-3">
                        {money(a.approved_amount ?? a.requested_amount)} · {date(a.submitted_at ?? a.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={a.status} />
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="KYC profile" description="From BVN verification" />
        <DescriptionList
          columns={4}
          items={[
            { label: "BVN", value: c.bvn_masked, mono: true },
            { label: "Phone", value: c.phone, mono: true },
            { label: "Alternate phone", value: c.phone_secondary, mono: true },
            { label: "Email", value: c.email },
            { label: "Date of birth", value: c.date_of_birth ? date(c.date_of_birth) : null },
            { label: "Gender", value: c.gender },
            { label: "Marital status", value: c.marital_status },
            { label: "Nationality", value: c.nationality },
            { label: "Address", value: c.residential_address },
            { label: "State / LGA of residence", value: join(c.state_of_residence, c.lga_of_residence) },
            { label: "State / LGA of origin", value: join(c.state_of_origin, c.lga_of_origin) },
            { label: "BVN enrolment", value: [c.enrollment_bank, c.enrollment_branch].filter(Boolean).join(" · ") },
            { label: "Account level", value: c.level_of_account },
            { label: "Last sign-in", value: c.last_login_at ? dateTime(c.last_login_at) : null },
          ]}
        />
      </Card>
    </>
  );
}
