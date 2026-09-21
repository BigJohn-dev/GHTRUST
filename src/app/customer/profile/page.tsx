"use client";

import { User, Shield, Building2, Phone, Mail, CreditCard } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { customers, CURRENT_CUSTOMER_ID } from "@/lib/mock-data";
import { formatNaira, formatDate } from "@/lib/utils";

export default function ProfilePage() {
  const addToast = useAppStore((s) => s.addToast);
  const customer = customers.find((c) => c.id === CURRENT_CUSTOMER_ID)!;

  const fields = [
    { icon: User, label: "Full Name", value: customer.name },
    { icon: Mail, label: "Email", value: customer.email },
    { icon: Phone, label: "Phone", value: customer.phone },
    { icon: CreditCard, label: "Account Number", value: customer.accountNumber },
    { icon: Shield, label: "BVN", value: `${customer.bvn.slice(0, 3)}****${customer.bvn.slice(-4)}` },
    { icon: Building2, label: "Branch", value: customer.branch },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-navy">Profile & Settings</h1>
        <p className="text-gray-500 text-sm">Manage your account information</p>
      </div>

      <Card>
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl gradient-navy flex items-center justify-center text-white text-2xl font-bold">AO</div>
          <div>
            <h2 className="text-xl font-bold text-navy">{customer.name}</h2>
            <p className="text-gray-500">{customer.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <StatusBadge status={customer.status} />
              <span className="text-xs text-gray-400">Member since {formatDate(customer.joinedDate)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Account Details</CardTitle>
        <div className="space-y-4 mt-4">
          {fields.map((f) => (
            <div key={f.label} className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
              <f.icon className="w-5 h-5 text-cyan" />
              <div className="flex-1">
                <p className="text-xs text-gray-500">{f.label}</p>
                <p className="font-medium text-navy">{f.value}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Account Summary</CardTitle>
        <div className="grid sm:grid-cols-3 gap-4 mt-4">
          <div className="bg-bg-light rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500">Savings</p>
            <p className="text-lg font-bold text-navy">{formatNaira(customer.savingsBalance)}</p>
          </div>
          <div className="bg-bg-light rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500">Wallet</p>
            <p className="text-lg font-bold text-cyan">{formatNaira(customer.walletBalance)}</p>
          </div>
          <div className="bg-bg-light rounded-xl p-4 text-center">
            <p className="text-xs text-gray-500">Investments</p>
            <p className="text-lg font-bold text-success">{formatNaira(customer.investmentBalance)}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Security</CardTitle>
        <div className="space-y-3 mt-4">
          <Button variant="outline" className="w-full justify-start" onClick={() => addToast("PIN change initiated", "info")}>Change Transaction PIN</Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => addToast("Password reset email sent", "info")}>Change Password</Button>
          <Button variant="outline" className="w-full justify-start" onClick={() => addToast("2FA enabled", "success")}>Enable Two-Factor Authentication</Button>
        </div>
      </Card>
    </div>
  );
}
