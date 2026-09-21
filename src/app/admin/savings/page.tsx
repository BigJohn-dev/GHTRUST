"use client";

import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { savingsProducts } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";

export default function AdminSavingsPage() {
  const addToast = useAppStore((s) => s.addToast);
  const savingsAccounts = useAppStore((s) => s.savingsAccounts);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Savings & Products</h1>
          <p className="text-gray-500 text-sm">Configure products and monitor savings accounts</p>
        </div>
        <Button onClick={() => addToast("Product configuration saved", "success")}>Edit Rates</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {savingsProducts.map((p) => (
          <Card key={p.id}>
            <h3 className="font-bold text-navy text-lg">{p.name}</h3>
            <p className="text-3xl font-bold text-cyan mt-2">{p.interestRate}%</p>
            <p className="text-xs text-gray-500 mt-1">Min deposit: {formatNaira(p.minDeposit)}</p>
            <p className="text-sm text-gray-500 mt-3">{p.description}</p>
            <ul className="mt-3 space-y-1">
              {p.features.map((f) => (
                <li key={f} className="text-xs text-gray-600 flex items-center gap-1">
                  <span className="w-1 h-1 bg-cyan rounded-full" />{f}
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
              <span className="text-gray-500">Active accounts</span>
              <span className="font-bold text-navy">{savingsAccounts.filter((a) => a.product === p.name).length}</span>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>All Savings Accounts</CardTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead><tr className="bg-bg-light text-left"><th className="px-4 py-3 font-semibold text-navy">Customer ID</th><th className="px-4 py-3 font-semibold text-navy">Product</th><th className="px-4 py-3 font-semibold text-navy">Balance</th><th className="px-4 py-3 font-semibold text-navy">Rate</th><th className="px-4 py-3 font-semibold text-navy">Opened</th><th className="px-4 py-3 font-semibold text-navy">Status</th></tr></thead>
            <tbody>
              {savingsAccounts.map((a) => (
                <tr key={a.id} className="border-t border-gray-50">
                  <td className="px-4 py-3">{a.customerId}</td>
                  <td className="px-4 py-3 font-medium text-navy">{a.product}</td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(a.balance)}</td>
                  <td className="px-4 py-3">{a.interestRate}%</td>
                  <td className="px-4 py-3 text-gray-500">{a.openedDate}</td>
                  <td className="px-4 py-3"><span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-semibold">{a.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
