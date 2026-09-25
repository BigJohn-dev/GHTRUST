"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/admin/Page";
import { Empty, ErrorState, NotLiveYet, Skeleton } from "@/components/admin/States";
import { catalogApi } from "@/lib/admin/endpoints";
import { useResource } from "@/lib/admin/hooks";
import { humanize, money } from "@/lib/admin/format";

export default function SavingsPage() {
  const products = useResource(() => catalogApi.savingsProducts());

  return (
    <>
      <PageHeader title="Savings" description="Savings products offered to customers." meta={<Badge variant="muted">Not live</Badge>} />

      <NotLiveYet
        title="Savings accounts are not live yet"
        detail="Customers can see these products, but opening an account and interest accrual are not built in the backend yet, so there are no accounts or balances to show."
      />

      <div className="mt-6">
        {products.loading && !products.data ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : products.error ? (
          <ErrorState message={products.error} onRetry={products.reload} />
        ) : (products.data ?? []).length === 0 ? (
          <Card>
            <Empty title="No savings products configured" hint="Run the backend seed to create the default products." />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {products.data!.map((p) => (
              <Card key={p.id} className="flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink">{p.name}</h3>
                  <Badge variant={p.is_active ? "success" : "muted"} dot>
                    {p.is_active ? "Offered" : "Hidden"}
                  </Badge>
                </div>
                <p className="num mt-3 text-3xl font-semibold tracking-tight text-navy">
                  {Number(p.interest_rate)}%<span className="ml-1 text-sm font-normal text-ink-3">p.a.</span>
                </p>
                <p className="text-xs text-ink-3">{humanize(p.product_type)}</p>
                {p.description && <p className="mt-3 text-sm text-ink-2">{p.description}</p>}
                <p className="num mt-auto border-t border-line pt-3 text-xs text-ink-3">
                  Minimum deposit <span className="font-semibold text-ink-2">{money(p.min_deposit)}</span>
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
