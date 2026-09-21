"use client";

import { useState } from "react";
import { Card, CardTitle } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { CURRENT_CUSTOMER_ID } from "@/lib/mock-data";
import { formatNaira, formatDateTime } from "@/lib/utils";

export default function TransactionsPage() {
  const transactions = useAppStore((s) => s.transactions);
  const [statusFilter, setStatusFilter] = useState("all");
  const myTxns = transactions.filter((t) => t.customerId === CURRENT_CUSTOMER_ID);
  const filtered = statusFilter === "all" ? myTxns : myTxns.filter((t) => t.status === statusFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Transactions</h1>
        <p className="text-gray-500 text-sm">Full history of your account activity</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        {[
          { label: "Total", count: myTxns.length, color: "text-navy" },
          { label: "Completed", count: myTxns.filter((t) => t.status === "completed").length, color: "text-success" },
          { label: "Pending", count: myTxns.filter((t) => t.status === "pending").length, color: "text-warning" },
          { label: "Failed", count: myTxns.filter((t) => t.status === "failed").length, color: "text-error" },
        ].map((s) => (
          <Card key={s.label} className="text-center py-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.count}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Transaction History</CardTitle>
        <DataTable
          data={filtered}
          searchKey="description"
          searchPlaceholder="Search transactions..."
          pageSize={10}
          filters={
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/30">
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          }
          columns={[
            { key: "description", header: "Description", render: (t) => <span className="font-medium text-navy">{t.description}</span> },
            { key: "category", header: "Category" },
            { key: "date", header: "Date", render: (t) => formatDateTime(t.date) },
            { key: "amount", header: "Amount", render: (t) => (
              <span className={`font-semibold ${t.type === "credit" ? "text-success" : "text-navy"}`}>
                {t.type === "credit" ? "+" : "-"}{formatNaira(t.amount)}
              </span>
            )},
            { key: "channel", header: "Channel" },
            { key: "status", header: "Status", render: (t) => <StatusBadge status={t.status} /> },
            { key: "reference", header: "Reference", render: (t) => <span className="text-xs text-gray-400 font-mono">{t.reference}</span> },
          ]}
        />
      </Card>
    </div>
  );
}
