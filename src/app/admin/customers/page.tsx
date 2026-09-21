"use client";

import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/Card";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/Badge";
import { customers } from "@/lib/mock-data";
import { formatNaira, formatDate } from "@/lib/utils";

export default function AdminCustomersPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Customers</h1>
        <p className="text-gray-500 text-sm">{customers.length} registered customers across all branches</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="text-center py-4"><p className="text-2xl font-bold text-navy">{customers.length}</p><p className="text-xs text-gray-500">Total</p></Card>
        <Card className="text-center py-4"><p className="text-2xl font-bold text-success">{customers.filter((c) => c.status === "active").length}</p><p className="text-xs text-gray-500">Active</p></Card>
        <Card className="text-center py-4"><p className="text-2xl font-bold text-warning">{customers.filter((c) => c.status === "inactive").length}</p><p className="text-xs text-gray-500">Inactive</p></Card>
        <Card className="text-center py-4"><p className="text-2xl font-bold text-cyan">{formatNaira(customers.reduce((s, c) => s + c.savingsBalance, 0))}</p><p className="text-xs text-gray-500">Total Savings</p></Card>
      </div>

      <Card>
        <CardTitle>Customer Directory</CardTitle>
        <DataTable
          data={customers}
          searchKey="name"
          searchPlaceholder="Search customers..."
          onRowClick={(c) => router.push(`/admin/customers/${c.id}`)}
          columns={[
            { key: "name", header: "Customer", render: (c) => (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-navy/10 flex items-center justify-center text-navy text-xs font-bold">
                  {c.name.split(" ").map((n: string) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-medium text-navy">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.email}</p>
                </div>
              </div>
            )},
            { key: "accountNumber", header: "Account" },
            { key: "branch", header: "Branch" },
            { key: "savingsBalance", header: "Savings", render: (c) => formatNaira(c.savingsBalance) },
            { key: "walletBalance", header: "Wallet", render: (c) => formatNaira(c.walletBalance) },
            { key: "joinedDate", header: "Joined", render: (c) => formatDate(c.joinedDate) },
            { key: "status", header: "Status", render: (c) => <StatusBadge status={c.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
