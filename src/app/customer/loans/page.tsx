"use client";

import Link from "next/link";
import { HandCoins, FileEdit, Plus, Calendar } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { loans, repaymentSchedules, CURRENT_CUSTOMER_ID } from "@/lib/mock-data";
import { formatNaira, formatDate, getProgressPercent } from "@/lib/utils";

export default function LoansPage() {
  const loanDrafts = useAppStore((s) => s.loanDrafts);
  const applications = useAppStore((s) => s.loanApplications.filter((a) => a.customerId === CURRENT_CUSTOMER_ID));
  const myLoans = loans.filter((l) => l.customerId === CURRENT_CUSTOMER_ID);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Loans</h1>
          <p className="text-gray-500 text-sm">View active loans and apply for new ones</p>
        </div>
        <Link href="/customer/loans/apply">
          <Button><Plus className="w-4 h-4" /> Apply for Loan</Button>
        </Link>
      </div>

      {loanDrafts.length > 0 && (
        <Card className="border-2 border-warning/30 bg-warning/5">
          <div className="flex items-center gap-2 mb-4">
            <FileEdit className="w-5 h-5 text-warning" />
            <CardTitle>Draft Applications</CardTitle>
          </div>
          <div className="space-y-3">
            {loanDrafts.map((draft) => (
              <Link key={draft.id} href={`/customer/loans/apply?draft=${draft.id}&product=${encodeURIComponent(draft.product)}`}>
                <div className="bg-white rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex-1">
                    <p className="font-semibold text-navy">{draft.product}</p>
                    <p className="text-sm text-gray-500">Step {draft.step} of {draft.totalSteps}</p>
                    <div className="w-full bg-gray-100 rounded-full h-2 mt-2 max-w-xs">
                      <div className="bg-warning h-2 rounded-full" style={{ width: `${getProgressPercent(draft.step, draft.totalSteps)}%` }} />
                    </div>
                  </div>
                  <Button size="sm" variant="outline">Continue</Button>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>Active Loans</CardTitle>
        {myLoans.length === 0 ? (
          <p className="text-gray-400 py-8 text-center">No active loans</p>
        ) : (
          <div className="space-y-4 mt-4">
            {myLoans.map((loan) => {
              const schedule = repaymentSchedules.filter((r) => r.loanId === loan.id);
              const paid = schedule.filter((r) => r.status === "paid").length;
              const progress = schedule.length ? Math.round((paid / schedule.length) * 100) : 0;
              return (
                <div key={loan.id} className="bg-bg-light rounded-xl p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-navy/10 rounded-xl"><HandCoins className="w-6 h-6 text-navy" /></div>
                      <div>
                        <p className="font-bold text-navy text-lg">{loan.product}</p>
                        <p className="text-sm text-gray-500">Disbursed {formatDate(loan.disbursementDate || loan.applicationDate)}</p>
                      </div>
                    </div>
                    <StatusBadge status={loan.status} />
                  </div>
                  <div className="grid sm:grid-cols-4 gap-4 mt-4">
                    <div><p className="text-xs text-gray-500">Principal</p><p className="font-bold text-navy">{formatNaira(loan.amount)}</p></div>
                    <div><p className="text-xs text-gray-500">Outstanding</p><p className="font-bold text-error">{formatNaira(loan.outstanding)}</p></div>
                    <div><p className="text-xs text-gray-500">Monthly Payment</p><p className="font-bold text-navy">{formatNaira(loan.monthlyPayment)}</p></div>
                    <div><p className="text-xs text-gray-500">Next Due</p><p className="font-bold text-warning flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDate(loan.nextDueDate)}</p></div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-500">Repayment progress</span><span className="font-semibold text-navy">{progress}%</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-success h-2 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  {schedule.length > 0 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="text-left text-gray-500"><th className="py-2">#</th><th>Due Date</th><th>Amount</th><th>Status</th></tr></thead>
                        <tbody>
                          {schedule.map((r) => (
                            <tr key={r.id} className="border-t border-gray-100">
                              <td className="py-2">{r.installment}</td>
                              <td>{formatDate(r.dueDate)}</td>
                              <td className="font-medium">{formatNaira(r.amount)}</td>
                              <td><StatusBadge status={r.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {applications.length > 0 && (
        <Card>
          <CardTitle>Application History</CardTitle>
          <div className="space-y-3 mt-4">
            {applications.map((app) => (
              <div key={app.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div>
                  <p className="font-medium text-navy">{app.product} — {formatNaira(app.amount)}</p>
                  <p className="text-xs text-gray-400">Submitted {formatDate(app.submittedDate)}</p>
                </div>
                <StatusBadge status={app.status} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
