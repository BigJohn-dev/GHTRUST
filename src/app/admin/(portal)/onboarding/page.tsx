"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ShareBars } from "@/components/admin/ShareBars";
import { FilterTabs, PageHeader, StatTile, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, Notice, PageSkeleton } from "@/components/admin/States";
import { onboardingApi } from "@/lib/admin/endpoints";
import { useResource } from "@/lib/admin/hooks";
import type { OnboardingSimulationPoint } from "@/lib/admin/types";

const PERIODS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 1000) / 10}%`);

/**
 * Pilot view: where sign-ups drop off, and how the face check performs at the
 * current settings versus the alternatives (evidence for DOJAH_SELFIE_THRESHOLD
 * and DOJAH_LIVENESS_MIN_PROBABILITY).
 */
export default function OnboardingPage() {
  const [days, setDays] = useState("30");
  const report = useResource(() => onboardingApi.report(Number(days)), [days]);

  if (report.loading && !report.data) return <PageSkeleton />;
  if (report.error) return <ErrorState message={report.error} onRetry={report.reload} />;
  const r = report.data!;
  const f = r.face_checks;
  const started = r.funnel[0]?.count ?? 0;
  const opened = r.funnel.find((s) => s.key === "account_open");

  return (
    <>
      <PageHeader
        title="Onboarding"
        description="Where sign-ups drop off, and how the face check performs. Use it to tune the pilot."
        actions={<FilterTabs label="Period" options={PERIODS} value={days} onChange={setDays} />}
      />

      <section aria-label="Headline figures" className="stagger mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Started sign-up" value={started} hint={`Entered a BVN in the last ${r.days} days`} />
        <StatTile label="Accounts opened" value={opened?.count ?? 0} hint={`${pct(opened?.rate_from_start)} of those who started`} />
        <StatTile
          label="Face check pass rate"
          value={pct(f.pass_rate)}
          hint={`${f.passed} of ${f.scored_attempts} checks · first try ${pct(f.first_try_pass_rate)}`}
          tone={f.pass_rate !== null && f.pass_rate < 0.7 ? "error" : "default"}
        />
        <StatTile
          label="Locked out after failed checks"
          value={f.cooldowns}
          hint="Customers who used every attempt"
          tone={f.cooldowns > 0 ? "error" : "default"}
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Sign-up funnel" description="Customers who started in the period, and how far each got" />
          {started === 0 ? (
            <Empty title="No sign-ups in this period" compact />
          ) : (
            <ShareBars
              max={started}
              items={r.funnel.map((s) => ({ key: s.key, label: s.label, value: s.count, sub: pct(s.rate_from_start) }))}
            />
          )}
        </Card>
        <Card>
          <CardHeader title="Face check results" description={`${f.attempts} checks by ${f.customers} customers`} />
          {f.attempts === 0 ? (
            <Empty title="No face checks in this period" compact />
          ) : (
            <ShareBars
              items={f.outcomes.map((o) => ({
                key: o.outcome,
                label: o.label,
                value: o.count,
                tone: o.outcome === "passed" ? "#00A86B" : undefined,
              }))}
            />
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-2xs font-semibold uppercase tracking-wider text-ink-3">Tuning the face check</h2>
      <Notice className="mb-4" title="How to read this">
        Each table replays this period&apos;s checks against other settings. A higher pass rate lets more genuine
        customers through, but also makes it easier for someone else&apos;s face to pass. Change the setting on the server
        (<code>DOJAH_SELFIE_THRESHOLD</code>, <code>DOJAH_LIVENESS_MIN_PROBABILITY</code>) only with enough checks
        behind it, ideally a few hundred.
      </Notice>
      <div className="grid items-start gap-6 xl:grid-cols-3">
        <SimulationCard
          title="Face match threshold"
          description={`Currently ${f.threshold}. Share of face matches that would pass.`}
          points={f.threshold_simulation}
          format={(v) => String(v)}
        />
        <SimulationCard
          title="Liveness minimum"
          description={
            f.liveness_min === null ? "Liveness check is switched off." : `Currently ${f.liveness_min}. Share that would pass.`
          }
          points={f.liveness_simulation}
          format={(v) => v.toFixed(1)}
        />
        <Card>
          <CardHeader title="Match scores" description="How closely faces matched the BVN photo" />
          {f.score_histogram.every((b) => b.count === 0) ? (
            <Empty title="No face matches yet" compact />
          ) : (
            <ShareBars items={f.score_histogram.map((b) => ({ key: b.label, label: b.label, value: b.count }))} />
          )}
        </Card>
      </div>
    </>
  );
}

function SimulationCard({
  title,
  description,
  points,
  format,
}: {
  title: string;
  description: string;
  points: OnboardingSimulationPoint[];
  format: (v: number) => string;
}) {
  const hasData = points.some((p) => p.pass_rate !== null);
  return (
    <Card flush>
      <div className="px-5 pt-5">
        <CardHeader title={title} description={description} />
      </div>
      {!hasData ? (
        <Empty title="Not enough checks yet" compact />
      ) : (
        <TableShell>
          <table className="tbl">
            <thead>
              <tr>
                <th>Setting</th>
                <th className="num">Would pass</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.value} className={p.current ? "bg-cyan/5" : undefined}>
                  <td className="font-medium text-ink">
                    {format(p.value)}
                    {p.current && <span className="ml-2 text-2xs font-semibold uppercase text-cyan">current</span>}
                  </td>
                  <td className="num font-semibold text-ink">{pct(p.pass_rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
    </Card>
  );
}
