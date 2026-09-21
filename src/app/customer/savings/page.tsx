"use client";

import { useState } from "react";
import { PiggyBank, Plus } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { savingsProducts } from "@/lib/mock-data";
import { formatNaira, formatDate } from "@/lib/utils";

export default function SavingsPage() {
  const savingsAccounts = useAppStore((s) => s.savingsAccounts);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const openSavingsAccount = useAppStore((s) => s.openSavingsAccount);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const handleOpen = () => {
    if (!selectedProduct || !amount) return;
    const num = parseInt(amount, 10);
    if (num <= 0 || num > walletBalance) return;
    openSavingsAccount(selectedProduct, num);
    setModalOpen(false);
    setAmount("");
    setSelectedProduct(null);
  };

  const totalBalance = savingsAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Savings</h1>
          <p className="text-gray-500 text-sm">Manage your savings accounts</p>
        </div>
        <Button onClick={() => setModalOpen(true)}><Plus className="w-4 h-4" /> Open Account</Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="gradient-navy text-white border-0">
          <p className="text-white/70 text-sm">Total Savings</p>
          <p className="text-3xl font-bold mt-1">{formatNaira(totalBalance)}</p>
        </Card>
        <Card>
          <p className="text-gray-500 text-sm">Active Accounts</p>
          <p className="text-3xl font-bold text-navy mt-1">{savingsAccounts.length}</p>
        </Card>
        <Card>
          <p className="text-gray-500 text-sm">Wallet Available</p>
          <p className="text-3xl font-bold text-cyan mt-1">{formatNaira(walletBalance)}</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Your Accounts</CardTitle>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {savingsAccounts.map((acc) => (
            <div key={acc.id} className="bg-bg-light rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-navy/10 rounded-lg"><PiggyBank className="w-5 h-5 text-navy" /></div>
                <div>
                  <p className="font-semibold text-navy">{acc.product}</p>
                  <StatusBadge status={acc.status} />
                </div>
              </div>
              <p className="text-2xl font-bold text-navy">{formatNaira(acc.balance)}</p>
              <p className="text-xs text-gray-500 mt-2">{acc.interestRate}% p.a. &middot; Opened {formatDate(acc.openedDate)}</p>
              {acc.maturityDate && <p className="text-xs text-cyan mt-1">Matures {formatDate(acc.maturityDate)}</p>}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Available Products</CardTitle>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {savingsProducts.map((p) => (
            <div key={p.id} className="border border-gray-100 rounded-xl p-5 hover:border-cyan/30 transition-colors">
              <h3 className="font-bold text-navy">{p.name}</h3>
              <p className="text-cyan font-semibold text-lg mt-1">{p.interestRate}% p.a.</p>
              <p className="text-sm text-gray-500 mt-2">{p.description}</p>
              <ul className="mt-3 space-y-1">
                {p.features.map((f) => (
                  <li key={f} className="text-xs text-gray-600 flex items-center gap-1">
                    <span className="w-1 h-1 bg-cyan rounded-full" />{f}
                  </li>
                ))}
              </ul>
              <Button size="sm" className="mt-4 w-full" onClick={() => { setSelectedProduct(p.name); setModalOpen(true); }}>
                Open {p.name}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Open Savings Account"
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleOpen} disabled={!selectedProduct || !amount}>Confirm</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-navy">Product</label>
            <select
              value={selectedProduct || ""}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan/30 focus:outline-none"
            >
              <option value="">Select product</option>
              {savingsProducts.map((p) => (
                <option key={p.id} value={p.name}>{p.name} ({p.interestRate}%)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-navy">Initial Deposit (₦)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-cyan/30 focus:outline-none"
            />
            <p className="text-xs text-gray-400 mt-1">Wallet balance: {formatNaira(walletBalance)}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
