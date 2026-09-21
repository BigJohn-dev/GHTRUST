"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { loans } from "@/lib/mock-data";
import { formatNaira, formatDate } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

export default function AdminLoansPage() {
  const addToast = useAppStore((s) => s.addToast);
  const [statusFilter, setStatusFilter] = useState("all");
  const [disburseModal, setDisburseModal] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState<typeof loans[0] | null>(null);

  const filtered = statusFilter === "all" ? loans : loans.filter((l) => l.status === statusFilter);
  const totalOutstanding = loans.reduce((s, l) => s + l.outstanding, 0);
  const totalDisbursed = loans.reduce((s, l) => s + l.disbursedAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Loan Book</h1>
          <p className="text-gray-500 text-sm">Active and historical loan portfolio</p>
        </div>
        <Button onClick={() => setDisburseModal(true)}>Disburse Loan</Button>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="gradient-navy text-white border-0 py-4 px-6"><p className="text-white/70 text-xs">Total Disbursed</p><p className="text-2xl font-bold">{formatNaira(totalDisbursed)}</p></Card>
        <Card className="py-4 px-6 text-center"><p className="text-xs text-gray-500">Outstanding</p><p className="text-2xl font-bold text-error">{formatNaira(totalOutstanding)}</p></Card>
        <Card className="py-4 px-6 text-center"><p className="text-xs text-gray-500">Active Loans</p><p className="text-2xl font-bold text-navy">{loans.filter((l) => l.status === "active").length}</p></Card>
        <Card className="py-4 px-6 text-center"><p className="text-xs text-gray-500">Overdue</p><p className="text-2xl font-bold text-error">{loans.filter((l) => l.status === "overdue").length}</p></Card>
      </div>

      <Card>
        <CardTitle>Loan Portfolio</CardTitle>
        <DataTable
          data={filtered}
          searchKey="customerName"
          searchPlaceholder="Search by customer..."
          filters={
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/30">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="overdue">Overdue</option>
              <option value="completed">Completed</option>
            </select>
          }
          columns={[
            { key: "customerName", header: "Customer" },
            { key: "product", header: "Product" },
            { key: "amount", header: "Principal", render: (l) => formatNaira(l.amount) },
            { key: "outstanding", header: "Outstanding", render: (l) => <span className="font-semibold text-error">{formatNaira(l.outstanding)}</span> },
            { key: "monthlyPayment", header: "Monthly", render: (l) => formatNaira(l.monthlyPayment) },
            { key: "interestRate", header: "Rate", render: (l) => `${l.interestRate}%` },
            { key: "nextDueDate", header: "Next Due", render: (l) => formatDate(l.nextDueDate) },
            { key: "branch", header: "Branch" },
            { key: "status", header: "Status", render: (l) => <StatusBadge status={l.status} /> },
            { key: "actions", header: "", render: (l) => (
              <Button size="sm" variant="ghost" onClick={() => { setSelectedLoan(l); setDisburseModal(true); }}>View</Button>
            )},
          ]}
        />
      </Card>

      <Modal isOpen={disburseModal} onClose={() => { setDisburseModal(false); setSelectedLoan(null); }}
        title={selectedLoan ? `Loan: ${selectedLoan.customerName}` : "Disburse New Loan"}
        footer={<Button onClick={() => { addToast("Loan disbursement initiated", "success"); setDisburseModal(false); }}>{selectedLoan ? "Send Reminder" : "Disburse"}</Button>}>
        {selectedLoan ? (
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Product</span><span className="font-medium">{selectedLoan.product}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Outstanding</span><span className="font-bold text-error">{formatNaira(selectedLoan.outstanding)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Next Due</span><span>{formatDate(selectedLoan.nextDueDate)}</span></div>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Select an approved application from the Loan Applications page to disburse, or use this for manual disbursement (demo).</p>
        )}
      </Modal>
    </div>
  );
}
