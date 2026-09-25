"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { customers, loans, transactions } from "@/lib/mock-data";
import { formatNaira, formatDate } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const addToast = useAppStore((s) => s.addToast);
  const customer = customers.find((c) => c.id === params.id);

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Customer not found</p>
        <Link href="/admin/customers"><Button className="mt-4">Back to Customers</Button></Link>
      </div>
    );
  }

  const customerLoans = loans.filter((l) => l.customerId === customer.id);
  const customerTxns = transactions.filter((t) => t.customerId === customer.id).slice(0, 5);

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-navy">
        <ArrowLeft className="w-4 h-4" /> Back to Customers
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl gradient-navy flex items-center justify-center text-white text-xl font-bold">
              {customer.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-navy">{customer.name}</h1>
              <p className="text-gray-500">{customer.email} &middot; {customer.phone}</p>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={customer.status} />
                <span className="text-xs text-gray-400">{customer.branch} &middot; Joined {formatDate(customer.joinedDate)}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addToast("KYC documents requested", "info")}>Request KYC</Button>
            <Button size="sm" onClick={() => addToast("Customer account updated", "success")}>Edit Profile</Button>
          </div>
        </div>
      </Card>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="text-center py-4"><p className="text-xs text-gray-500">Savings</p><p className="text-xl font-bold text-navy">{formatNaira(customer.savingsBalance)}</p></Card>
        <Card className="text-center py-4"><p className="text-xs text-gray-500">Wallet</p><p className="text-xl font-bold text-cyan">{formatNaira(customer.walletBalance)}</p></Card>
        <Card className="text-center py-4"><p className="text-xs text-gray-500">Investments</p><p className="text-xl font-bold text-success">{formatNaira(customer.investmentBalance)}</p></Card>
        <Card className="text-center py-4"><p className="text-xs text-gray-500">Account</p><p className="text-lg font-bold text-navy font-mono">{customer.accountNumber}</p></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Active Loans ({customerLoans.length})</CardTitle>
          {customerLoans.length === 0 ? (
            <p className="text-gray-400 py-6 text-center text-sm">No active loans</p>
          ) : (
            <div className="space-y-3 mt-4">
              {customerLoans.map((loan) => (
                <div key={loan.id} className="bg-bg-light rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <p className="font-semibold text-navy">{loan.product}</p>
                    <StatusBadge status={loan.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm">
                    <span className="text-gray-500">Amount: <strong className="text-navy">{formatNaira(loan.amount)}</strong></span>
                    <span className="text-gray-500">Outstanding: <strong className="text-error">{formatNaira(loan.outstanding)}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardTitle>Recent Transactions</CardTitle>
          <div className="space-y-3 mt-4">
            {customerTxns.map((txn) => (
              <div key={txn.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-navy">{txn.description}</p>
                  <p className="text-xs text-gray-400">{formatDate(txn.date)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${txn.type === "credit" ? "text-success" : "text-navy"}`}>
                    {txn.type === "credit" ? "+" : "-"}{formatNaira(txn.amount)}
                  </p>
                  <StatusBadge status={txn.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle>Account Information</CardTitle>
        <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
          <div><span className="text-gray-500">BVN:</span> <span className="font-medium text-navy ml-2">{customer.bvn}</span></div>
          <div><span className="text-gray-500">Branch:</span> <span className="font-medium text-navy ml-2">{customer.branch}</span></div>
          <div><span className="text-gray-500">Phone:</span> <span className="font-medium text-navy ml-2">{customer.phone}</span></div>
          <div><span className="text-gray-500">Email:</span> <span className="font-medium text-navy ml-2">{customer.email}</span></div>
        </div>
      </Card>
    </div>
  );
}
