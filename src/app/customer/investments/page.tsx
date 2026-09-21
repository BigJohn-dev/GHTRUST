"use client";

import { useState } from "react";
import { TrendingUp, Calculator } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { investmentPlans } from "@/lib/mock-data";
import { formatNaira, formatDate } from "@/lib/utils";

export default function InvestmentsPage() {
  const investments = useAppStore((s) => s.investments);
  const walletBalance = useAppStore((s) => s.walletBalance);
  const makeInvestment = useAppStore((s) => s.makeInvestment);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof investmentPlans[0] | null>(null);
  const [amount, setAmount] = useState("");
  const [calcAmount, setCalcAmount] = useState("100000");
  const [calcTenure, setCalcTenure] = useState("12");

  const calcReturn = () => {
    const a = parseInt(calcAmount, 10) || 0;
    const t = parseInt(calcTenure, 10) || 12;
    const rate = 18;
    return Math.round(a * (rate / 100) * (t / 12));
  };

  const handleInvest = () => {
    if (!selectedPlan || !amount) return;
    const num = parseInt(amount, 10);
    if (num < selectedPlan.minAmount || num > walletBalance) return;
    makeInvestment(selectedPlan.name, num, selectedPlan.returnRate, selectedPlan.tenure);
    setModalOpen(false);
    setAmount("");
  };

  const riskColor = { low: "success", medium: "warning", high: "error" } as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Investments</h1>
        <p className="text-gray-500 text-sm">Grow your wealth with GH Trust investment plans</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardTitle>Investment Calculator</CardTitle>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="text-sm font-medium text-navy">Amount (₦)</label>
              <input type="number" value={calcAmount} onChange={(e) => setCalcAmount(e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
            </div>
            <div>
              <label className="text-sm font-medium text-navy">Tenure (months)</label>
              <input type="number" value={calcTenure} onChange={(e) => setCalcTenure(e.target.value)} className="w-full mt-1 px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
            </div>
          </div>
          <div className="mt-6 p-6 bg-bg-light rounded-xl flex items-center gap-4">
            <Calculator className="w-10 h-10 text-cyan" />
            <div>
              <p className="text-sm text-gray-500">Projected Return (18% p.a.)</p>
              <p className="text-3xl font-bold text-navy">{formatNaira(calcReturn())}</p>
            </div>
          </div>
        </Card>
        <Card className="gradient-navy text-white border-0">
          <p className="text-white/70 text-sm">Portfolio Value</p>
          <p className="text-3xl font-bold mt-1">{formatNaira(investments.reduce((s, i) => s + i.amount, 0))}</p>
          <p className="text-white/60 text-sm mt-2">{investments.filter((i) => i.status === "active").length} active plan(s)</p>
        </Card>
      </div>

      <Card>
        <CardTitle>Your Investments</CardTitle>
        {investments.length === 0 ? (
          <p className="text-gray-400 py-8 text-center">No investments yet</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {investments.map((inv) => (
              <div key={inv.id} className="bg-bg-light rounded-xl p-5">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-cyan" />
                    <p className="font-semibold text-navy">{inv.planName}</p>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="text-2xl font-bold text-navy mt-3">{formatNaira(inv.amount)}</p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs text-gray-500">
                  <span>Return: {inv.returnRate}%</span>
                  <span>Matures: {formatDate(inv.maturityDate)}</span>
                  <span className="col-span-2 text-success font-medium">Projected: {formatNaira(inv.projectedReturn)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardTitle>Available Plans</CardTitle>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          {investmentPlans.map((plan) => (
            <div key={plan.id} className="border border-gray-100 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <h3 className="font-bold text-navy">{plan.name}</h3>
                <Badge variant={riskColor[plan.risk]}>{plan.risk} risk</Badge>
              </div>
              <p className="text-2xl font-bold text-cyan mt-2">{plan.returnRate}%</p>
              <p className="text-xs text-gray-500">{plan.tenure} months &middot; Min {formatNaira(plan.minAmount)}</p>
              <p className="text-sm text-gray-500 mt-2">{plan.description}</p>
              <Button size="sm" className="mt-4 w-full" onClick={() => { setSelectedPlan(plan); setModalOpen(true); }}>Invest Now</Button>
            </div>
          ))}
        </div>
      </Card>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={`Invest in ${selectedPlan?.name}`}
        footer={<><Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button><Button onClick={handleInvest}>Confirm Investment</Button></>}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Min: {formatNaira(selectedPlan?.minAmount || 0)} &middot; Wallet: {formatNaira(walletBalance)}</p>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Investment amount" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
        </div>
      </Modal>
    </div>
  );
}
