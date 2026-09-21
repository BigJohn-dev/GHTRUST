"use client";

import { useState } from "react";
import { Wallet, Plus, ArrowDownToLine, Send } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { VirtualCard } from "@/components/ui/VirtualCard";
import { useAppStore } from "@/lib/store";
import { formatNaira } from "@/lib/utils";

export default function WalletPage() {
  const walletBalance = useAppStore((s) => s.walletBalance);
  const fundWallet = useAppStore((s) => s.fundWallet);
  const withdrawWallet = useAppStore((s) => s.withdrawWallet);
  const addToast = useAppStore((s) => s.addToast);
  const [fundModal, setFundModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");

  const quickAmounts = [5000, 10000, 25000, 50000, 100000];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Wallet</h1>
        <p className="text-gray-500 text-sm">Fund, withdraw, and transfer from your GH Trust wallet</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <VirtualCard balance={walletBalance} />
        <Card>
          <CardTitle>Quick Actions</CardTitle>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <button onClick={() => setFundModal(true)} className="bg-success/10 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <Plus className="w-8 h-8 text-success mx-auto mb-2" />
              <span className="text-sm font-semibold text-navy">Add Fund</span>
            </button>
            <button onClick={() => setWithdrawModal(true)} className="bg-warning/10 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <ArrowDownToLine className="w-8 h-8 text-warning mx-auto mb-2" />
              <span className="text-sm font-semibold text-navy">Withdraw</span>
            </button>
            <button onClick={() => setTransferModal(true)} className="bg-cyan/10 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
              <Send className="w-8 h-8 text-cyan mx-auto mb-2" />
              <span className="text-sm font-semibold text-navy">Transfer</span>
            </button>
          </div>
          <div className="mt-6 p-4 bg-bg-light rounded-xl">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-navy" />
              <div>
                <p className="text-sm text-gray-500">Available Balance</p>
                <p className="text-2xl font-bold text-navy">{formatNaira(walletBalance)}</p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Modal isOpen={fundModal} onClose={() => { setFundModal(false); setAmount(""); }} title="Fund Wallet"
        footer={<><Button variant="ghost" onClick={() => setFundModal(false)}>Cancel</Button><Button onClick={() => { fundWallet(parseInt(amount, 10)); setFundModal(false); setAmount(""); }} disabled={!amount}>Fund Wallet</Button></>}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {quickAmounts.map((a) => (
              <button key={a} onClick={() => setAmount(String(a))} className={`px-4 py-2 rounded-lg text-sm font-medium border ${amount === String(a) ? "border-cyan bg-cyan/10 text-cyan" : "border-gray-200 text-gray-600"}`}>
                {formatNaira(a)}
              </button>
            ))}
          </div>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Custom amount" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
          <p className="text-xs text-gray-400">Funds will be credited instantly (demo mode).</p>
        </div>
      </Modal>

      <Modal isOpen={withdrawModal} onClose={() => { setWithdrawModal(false); setAmount(""); }} title="Withdraw to Bank"
        footer={<><Button variant="ghost" onClick={() => setWithdrawModal(false)}>Cancel</Button><Button onClick={() => { withdrawWallet(parseInt(amount, 10)); setWithdrawModal(false); setAmount(""); }} disabled={!amount}>Withdraw</Button></>}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Withdraw to: GTBank ****4521</p>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
          <p className="text-xs text-gray-400">Available: {formatNaira(walletBalance)}</p>
        </div>
      </Modal>

      <Modal isOpen={transferModal} onClose={() => { setTransferModal(false); setAmount(""); setRecipient(""); }} title="Transfer Funds"
        footer={<><Button variant="ghost" onClick={() => setTransferModal(false)}>Cancel</Button><Button onClick={() => { addToast(`Transfer of ₦${parseInt(amount || "0").toLocaleString()} to ${recipient} initiated`, "success"); setTransferModal(false); }} disabled={!amount || !recipient}>Send</Button></>}>
        <div className="space-y-4">
          <input type="text" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Recipient account number" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
        </div>
      </Modal>
    </div>
  );
}
