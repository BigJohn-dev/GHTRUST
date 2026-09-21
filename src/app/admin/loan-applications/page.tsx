"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmModal } from "@/components/ui/Modal";
import { useAppStore } from "@/lib/store";
import { formatNaira, formatDate } from "@/lib/utils";

export default function LoanApplicationsPage() {
  const applications = useAppStore((s) => s.loanApplications);
  const approveApplication = useAppStore((s) => s.approveApplication);
  const rejectApplication = useAppStore((s) => s.rejectApplication);
  const [statusFilter, setStatusFilter] = useState("all");
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: "approve" | "reject" } | null>(null);

  const filtered = statusFilter === "all" ? applications : applications.filter((a) => a.status === statusFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Loan Applications</h1>
          <p className="text-gray-500 text-sm">{applications.filter((a) => a.status === "pending" || a.status === "under_review").length} awaiting action</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        {[
          { label: "Pending", status: "pending", color: "text-warning" },
          { label: "Under Review", status: "under_review", color: "text-cyan" },
          { label: "Approved", status: "approved", color: "text-success" },
          { label: "Rejected", status: "rejected", color: "text-error" },
        ].map((s) => (
          <Card key={s.status} className="text-center py-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter(s.status)}>
            <p className={`text-2xl font-bold ${s.color}`}>{applications.filter((a) => a.status === s.status).length}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Application Queue</CardTitle>
        <DataTable
          data={filtered}
          searchKey="customerName"
          searchPlaceholder="Search applicants..."
          filters={
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/30">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          }
          columns={[
            { key: "customerName", header: "Applicant", render: (a) => (
              <div>
                <p className="font-medium text-navy">{a.customerName}</p>
                <p className="text-xs text-gray-400">{a.branch}</p>
              </div>
            )},
            { key: "product", header: "Product" },
            { key: "amount", header: "Amount", render: (a) => <span className="font-semibold">{formatNaira(a.amount)}</span> },
            { key: "tenure", header: "Tenure", render: (a) => `${a.tenure} months` },
            { key: "monthlyIncome", header: "Income", render: (a) => formatNaira(a.monthlyIncome) },
            { key: "purpose", header: "Purpose", className: "max-w-[200px]", render: (a) => <span className="truncate block max-w-[200px]">{a.purpose}</span> },
            { key: "submittedDate", header: "Submitted", render: (a) => formatDate(a.submittedDate) },
            { key: "status", header: "Status", render: (a) => <StatusBadge status={a.status} /> },
            { key: "actions", header: "Actions", render: (a) => (
              (a.status === "pending" || a.status === "under_review") ? (
                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setConfirmAction({ id: a.id, action: "approve" })} className="p-1.5 bg-success/10 text-success rounded-lg hover:bg-success/20"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setConfirmAction({ id: a.id, action: "reject" })} className="p-1.5 bg-error/10 text-error rounded-lg hover:bg-error/20"><X className="w-4 h-4" /></button>
                </div>
              ) : <span className="text-xs text-gray-400">—</span>
            )},
          ]}
        />
      </Card>

      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (!confirmAction) return;
          if (confirmAction.action === "approve") approveApplication(confirmAction.id);
          else rejectApplication(confirmAction.id);
        }}
        title={confirmAction?.action === "approve" ? "Approve Application" : "Reject Application"}
        message={confirmAction?.action === "approve" ? "Are you sure you want to approve this loan application?" : "Are you sure you want to reject this loan application?"}
        confirmLabel={confirmAction?.action === "approve" ? "Approve" : "Reject"}
        variant={confirmAction?.action === "reject" ? "danger" : "primary"}
      />
    </div>
  );
}
