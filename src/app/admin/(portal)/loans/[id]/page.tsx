"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Field, PageHeader, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, InlineError, Notice, PageSkeleton } from "@/components/admin/States";
import { P, useStaffAuth } from "@/lib/admin/auth";
import { loansApi } from "@/lib/admin/endpoints";
import { useAction, useResource } from "@/lib/admin/hooks";
import { date, dateTime, humanize, money } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import type { LoanDetail } from "@/lib/admin/types";

export default function LoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const loan = useResource(() => loansApi.get(id), [id], { key: `loan:${id}` });
  const { can } = useStaffAuth();
  const [recordOpen, setRecordOpen] = useState(false);
  const [recorded, setRecorded] = useState<string | null>(null);

  if (loan.loading && !loan.data) return <PageSkeleton />;
  if (loan.error) return <ErrorState message={loan.error} onRetry={loan.reload} />;
  const l = loan.data!;
  const repayable = l.status === "active" || l.status === "overdue";
  const paidPct = Number(l.total_repayable) > 0 ? (Number(l.amount_paid) / Number(l.total_repayable)) * 100 : 0;
  const nextDue = l.schedule.find((s) => Number(s.amount_due) > 0);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/loans", label: "Loan book" }}
        title={l.customer_name ?? "Borrower"}
        meta={<StatusBadge status={l.status} />}
        description={`${humanize(l.product_type)} · Disbursed ${date(l.disbursement_date)} · ${l.tenure_months} months · ${l.installments_count} ${humanize(
          l.repayment_cadence,
        ).toLowerCase()} installments · ${Number(l.interest_rate)}% per month (${humanize(l.interest_method).toLowerCase()})`}
        actions={
          <>
            <ButtonLink href={`/admin/customers/${l.customer_id}`} variant="outline">
              Customer
            </ButtonLink>
            {l.application_id && (
              <ButtonLink href={`/admin/loan-applications/${l.application_id}`} variant="outline">
                Application
              </ButtonLink>
            )}
            {repayable && can(P.LOAN_RECORD_REPAYMENT) && (
              <Button onClick={() => setRecordOpen(true)}>
                <Plus className="h-4 w-4" /> Record repayment
              </Button>
            )}
          </>
        }
      />

      {recorded && (
        <Notice tone="success" className="mb-6" title="Repayment recorded">
          {recorded}
        </Notice>
      )}

      <Card className="mb-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
          <Figure label="Principal" value={money(l.principal)} />
          <Figure label="Interest" value={money(l.total_interest)} />
          <Figure label="Total repayable" value={money(l.total_repayable)} />
          <Figure label="Paid" value={money(l.amount_paid)} tone="text-success" />
          <Figure label="Outstanding" value={money(l.outstanding)} tone={l.status === "overdue" ? "text-error" : "text-ink"} />
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-ink-3">
              <span className="num font-semibold text-ink-2">{paidPct.toFixed(0)}%</span> repaid
            </span>
            {nextDue && (
              <span className="text-ink-3">
                Next: <span className="num font-semibold text-ink-2">{money(nextDue.amount_due, { decimals: true })}</span> on {date(nextDue.due_date)}
              </span>
            )}
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
            role="progressbar"
            aria-valuenow={Math.round(paidPct)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Repaid"
          >
            <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${Math.min(100, paidPct)}%` }} />
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-6 2xl:grid-cols-3">
        <Card flush className="2xl:col-span-2">
          <div className="px-5 pt-5">
            <CardHeader title="Repayment schedule" description={`${l.schedule.length} installments`} />
          </div>
          <TableShell>
            <table className="tbl tbl-compact">
              <thead>
                <tr>
                  <th className="w-12">#</th>
                  <th>Due</th>
                  <th className="num">Principal</th>
                  <th className="num">Interest</th>
                  <th className="num">Amount</th>
                  <th className="num">Still due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="stagger-rows">
                {l.schedule.map((s) => {
                  const isNext = nextDue?.installment === s.installment;
                  return (
                    <tr key={s.installment} className={cn(isNext && "[&>td]:bg-cyan-soft/60")}>
                      <td className="text-ink-3">{s.installment}</td>
                      <td className="whitespace-nowrap">
                        {date(s.due_date)}
                        {isNext && <span className="ml-2 text-2xs font-semibold uppercase tracking-wide text-cyan">Next</span>}
                      </td>
                      <td className="num">{money(s.principal, { decimals: true })}</td>
                      <td className="num">{money(s.interest, { decimals: true })}</td>
                      <td className="num font-semibold text-ink">{money(s.amount, { decimals: true })}</td>
                      <td className="num">{Number(s.amount_due) > 0 ? money(s.amount_due, { decimals: true }) : <span className="text-gray-300">—</span>}</td>
                      <td>
                        <StatusBadge status={s.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        </Card>

        <Card>
          <CardHeader title="Payments received" description={l.repayments.length ? `${l.repayments.length} payment${l.repayments.length === 1 ? "" : "s"}` : undefined} />
          {l.repayments.length === 0 ? (
            <Empty title="No repayments yet" compact />
          ) : (
            <ul className="divide-y divide-line">
              {l.repayments.map((r) => (
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="num font-semibold text-ink">{money(r.amount, { decimals: true })}</p>
                    <span className="text-xs text-ink-3">{humanize(r.channel)}</span>
                  </div>
                  <p className="num mt-0.5 text-xs text-ink-2">
                    Principal {money(r.principal_amount)} · Interest {money(r.interest_amount)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    {dateTime(r.paid_at)} · <span className="font-mono">{r.reference.replace(/^staff_/, "")}</span>
                  </p>
                  {r.note && <p className="mt-1 text-xs text-ink-2">{r.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <RecordRepaymentModal
        loan={l}
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        onSaved={(message) => {
          setRecorded(message);
          loan.reload();
        }}
      />
    </>
  );
}

function Figure({ label, value, tone = "text-ink" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-3">{label}</p>
      <p className={cn("num mt-1 truncate text-lg font-semibold", tone)} title={value}>
        {value}
      </p>
    </div>
  );
}

function RecordRepaymentModal({
  loan,
  open,
  onClose,
  onSaved,
}: {
  loan: LoanDetail;
  open: boolean;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [amount, setAmount] = useState("");
  const [channel, setChannel] = useState<"bank_transfer" | "cash" | "remita" | "other">("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [note, setNote] = useState("");
  const action = useAction();
  const nextDue = loan.schedule.find((s) => Number(s.amount_due) > 0);

  async function save() {
    const value = Number(amount);
    if (!value || value <= 0) return action.setError("Enter the amount received.");
    if (value > Number(loan.outstanding)) return action.setError(`That is more than the outstanding ${money(loan.outstanding, { decimals: true })}.`);
    if (reference.trim().length < 3) return action.setError("Enter the bank or teller reference.");
    const ok = await action.run(() =>
      loansApi.recordRepayment(loan.id, {
        amount: value.toFixed(2),
        channel,
        reference: reference.trim(),
        paid_at: paidAt ? new Date(paidAt).toISOString() : undefined,
        note: note.trim() || undefined,
      }),
    );
    if (ok) {
      const message = `${money(value, { decimals: true })} via ${humanize(channel).toLowerCase()} (ref ${reference.trim()}).`;
      setAmount("");
      setReference("");
      setNote("");
      setPaidAt("");
      onClose();
      onSaved(message);
    }
  }

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Record repayment"
      description="For money received outside the app. It's applied to the oldest unpaid installment, interest first."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={action.busy} onClick={save}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {nextDue && (
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2.5 text-[13px]">
            <span className="text-ink-3">
              Next due {date(nextDue.due_date)} · outstanding {money(loan.outstanding, { decimals: true })}
            </span>
            <Button size="xs" variant="outline" onClick={() => setAmount(Number(nextDue.amount_due).toFixed(2))}>
              Use {money(nextDue.amount_due, { decimals: true })}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount (₦)" required>
            {(id) => <input id={id} className="input num" type="number" inputMode="decimal" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />}
          </Field>
          <Field label="Channel">
            {(id) => (
              <select id={id} className="input" value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)}>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cash">Cash (branch)</option>
                <option value="remita">Remita</option>
                <option value="other">Other</option>
              </select>
            )}
          </Field>
        </div>
        <Field label="Reference" required hint="Bank session ID or teller receipt number. Re-sending the same reference never posts the payment twice.">
          {(id, d) => <input id={id} aria-describedby={d} className="input font-mono" value={reference} onChange={(e) => setReference(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Paid at" hint="Defaults to now">
            {(id, d) => <input id={id} aria-describedby={d} className="input" type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />}
          </Field>
          <Field label="Note (optional)">
            {(id) => <input id={id} className="input" value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
        </div>
        <InlineError message={action.error} />
      </div>
    </Modal>
  );
}
