"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { PageHeader, SearchInput, SelectFilter, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, Pager, TableSkeleton } from "@/components/admin/States";
import { settingsApi } from "@/lib/admin/endpoints";
import { useDebouncedValue, useResource } from "@/lib/admin/hooks";
import { dateTime, humanize, relativeTime } from "@/lib/admin/format";
import { downloadCsv } from "@/lib/admin/csv";
import type { GlobalAuditLogEntry } from "@/lib/admin/types";

const PAGE = 50;

// Mirrors AuditEventType in backend/app/modules/loans/workflow_models.py.
const EVENT_TYPES = [
  "application_created",
  "application_submitted",
  "application_viewed",
  "bvn_viewed",
  "workflow_assigned",
  "stage_entered",
  "stage_approved",
  "stage_rejected",
  "status_changed",
  "document_verified",
  "document_rejected",
  "disbursed",
];

/** Sensitive-data events stand out; everything else stays neutral. */
function eventVariant(event: string) {
  if (event.includes("bvn")) return "warning" as const;
  if (event.includes("reject")) return "error" as const;
  if (event.includes("approv") || event.includes("verified") || event.includes("disburs")) return "success" as const;
  return "default" as const;
}

export default function AuditLogPage() {
  const [offset, setOffset] = useState(0);
  const [event, setEvent] = useState("all");
  const [filter, setFilter] = useState("");
  const search = useDebouncedValue(filter.trim(), 300);

  useEffect(() => setOffset(0), [event, search]);

  const logs = useResource(
    () =>
      settingsApi.auditLogs({
        event_type: event === "all" ? undefined : event,
        search: search || undefined,
        limit: PAGE,
        offset,
      }),
    [event, search, offset],
  );
  const rows = logs.data?.items ?? [];

  function exportRows() {
    downloadCsv<GlobalAuditLogEntry>("audit-log", rows, [
      { header: "Time", value: (l) => l.created_at },
      { header: "Event", value: (l) => humanize(l.event_type) },
      { header: "Message", value: (l) => l.message },
      { header: "Actor", value: (l) => l.actor_label ?? l.actor_type },
      { header: "IP address", value: (l) => l.ip_address },
      { header: "Application ID", value: (l) => l.application_id },
    ]);
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Staff actions on loan applications: views, BVN access, approvals, document checks and disbursements."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={rows.length === 0} title="Exports the rows shown on this page">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        }
      />

      <Card flush>
        <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={filter}
            onChange={setFilter}
            placeholder="Search message, person or IP"
            aria-label="Search the audit log"
            containerClassName="sm:max-w-sm sm:flex-1"
          />
          <SelectFilter
            label="Event type"
            value={event}
            onChange={setEvent}
            options={[{ value: "all", label: "All events" }, ...EVENT_TYPES.map((t) => ({ value: t, label: humanize(t) }))]}
          />
          {logs.data && (
            <p className="num text-xs text-ink-3 sm:ml-auto">
              {logs.data.total} event{logs.data.total === 1 ? "" : "s"}
            </p>
          )}
        </div>

        {logs.loading && !logs.data ? (
          <TableSkeleton cols={5} rows={8} />
        ) : logs.error ? (
          <div className="p-5">
            <ErrorState message={logs.error} onRetry={logs.reload} />
          </div>
        ) : rows.length === 0 ? (
          <Empty title="No matching activity" hint={search || event !== "all" ? "Try a different search or event type." : undefined} />
        ) : (
          <TableShell>
            <table className="tbl tbl-compact">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Event</th>
                  <th>Details</th>
                  <th>By</th>
                  <th>IP</th>
                  <th />
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {rows.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <time dateTime={log.created_at} title={dateTime(log.created_at)} className="text-ink">
                        {relativeTime(log.created_at)}
                      </time>
                      <span className="block text-xs text-ink-3">{dateTime(log.created_at)}</span>
                    </td>
                    <td>
                      <Badge variant={eventVariant(log.event_type)}>{humanize(log.event_type)}</Badge>
                    </td>
                    <td className="min-w-[240px] whitespace-normal text-ink">{log.message ?? "—"}</td>
                    <td>{log.actor_label ?? humanize(log.actor_type)}</td>
                    <td className="font-mono text-xs tabular-nums">{log.ip_address ?? "—"}</td>
                    <td className="text-right">
                      <Link href={`/admin/loan-applications/${log.application_id}`} className="link text-[13px]">
                        Application
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
        <Pager total={logs.data?.total} limit={PAGE} offset={offset} onChange={setOffset} />
      </Card>
    </>
  );
}
