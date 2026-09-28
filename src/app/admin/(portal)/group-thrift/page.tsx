"use client";

import { UsersRound } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/admin/Page";
import { Empty, ErrorState, NotLiveYet, Skeleton } from "@/components/admin/States";
import { catalogApi } from "@/lib/admin/endpoints";
import { useResource } from "@/lib/admin/hooks";
import { date, money } from "@/lib/admin/format";

export default function GroupThriftPage() {
  const groups = useResource(() => catalogApi.contributionGroups());

  return (
    <>
      <PageHeader title="Group thrift (Ajo)" description="Cooperative savings groups." meta={<Badge variant="muted">Not live</Badge>} />

      <NotLiveYet
        title="Contributions are not live yet"
        detail="Groups can be listed, but recording contributions, payouts and service fees is not built in the backend yet. Creating groups from the portal is also not available."
      />

      <div className="mt-6">
        {groups.loading && !groups.data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : groups.error ? (
          <ErrorState message={groups.error} onRetry={groups.reload} />
        ) : (groups.data ?? []).length === 0 ? (
          <Card>
            <Empty title="No groups yet" icon={UsersRound} />
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 3xl:grid-cols-3">
            {groups.data!.map((g) => {
              const target = Number(g.target_amount);
              const progress = target > 0 ? Math.round((Number(g.collected_amount) / target) * 100) : 0;
              return (
                <Card key={g.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                        <UsersRound className="h-[18px] w-[18px] text-ink-3" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-ink">{g.name}</h3>
                        <p className="text-xs text-ink-3">
                          Leader: {g.leader_name} · {g.member_count} members
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={g.status} />
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span className="num text-ink-2">
                        {money(g.collected_amount)} <span className="text-ink-3">of {money(g.target_amount)}</span>
                      </span>
                      <span className="num font-semibold text-ink">{progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-navy" style={{ width: `${Math.min(100, progress)}%` }} />
                    </div>
                  </div>
                  <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
                    Cycle #{g.cycle} · Next meeting {date(g.next_meeting)} · {g.branch} · {Number(g.service_fee_percent)}% fee
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
