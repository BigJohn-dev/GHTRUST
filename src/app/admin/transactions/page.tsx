"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { formatNaira, formatDateTime } from "@/lib/utils";

export default function AdminTransactionsPage() {
  const transactions = useAppStore((s) => s.transactions);
  const addToast = useAppStore((s) => s.addToast);
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = statusFilter === "all" ? transactions : transactions.filter((t) => t.status === statusFilter);
  const totalVolume = transactions.filter((t) => t.status === "completed").reduce((s, t) => s + t.amount, 0);
  const pendingRecon = transactions.filter((t) => t.status === "pending").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Transactions & Reconciliation</h1>
          <p className="text-gray-500 text-sm">Monitor and reconcile all platform transactions</p>
        </div>
        <Button variant="outline" onClick={() => addToast("Reconciliation run completed — 0 mismatches", "success")}>Run Reconciliation</Button>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="py-4 px-6"><p className="text-xs text-gray-500">Total Volume</p><p className="text-xl font-bold text-navy">{formatNaira(totalVolume)}</p></Card>
        <Card className="py-4 px-6 text-center"><p className="text-xs text-gray-500">Transactions</p><p className="text-2xl font-bold text-navy">{transactions.length}</p></Card>
        <Card className="py-4 px-6 text-center"><p className="text-xs text-gray-500">Pending Recon</p><p className="text-2xl font-bold text-warning">{pendingRecon}</p></Card>
        <Card className="py-4 px-6 text-center"><p className="text-xs text-gray-500">Failed</p><p className="text-2xl font-bold text-error">{transactions.filter((t) => t.status === "failed").length}</p></Card>
      </div>

      <Card>
        <CardTitle>Transaction Ledger</CardTitle>
        <DataTable
          data={filtered}
          searchKey="customerName"
          searchPlaceholder="Search by customer..."
          pageSize={10}
          filters={
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/30">
              <option value="all">All</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          }
          columns={[
            { key: "reference", header: "Ref", render: (t) => <span className="font-mono text-xs">{t.reference}</span> },
            { key: "customerName", header: "Customer" },
            { key: "description", header: "Description" },
            { key: "category", header: "Category" },
            { key: "amount", header: "Amount", render: (t) => (
              <span className={`font-semibold ${t.type === "credit" ? "text-success" : "text-navy"}`}>
                {t.type === "credit" ? "+" : "-"}{formatNaira(t.amount)}
              </span>
            )},
            { key: "channel", header: "Channel" },
            { key: "date", header: "Date", render: (t) => formatDateTime(t.date) },
            { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
