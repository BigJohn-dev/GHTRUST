"use client";

import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import {
  Plus, Send, PiggyBank, HandCoins, FileEdit, ChevronRight,
  Wallet, TrendingUp, ArrowUpRight,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { VirtualCard } from "@/components/ui/VirtualCard";
import { StatusBadge } from "@/components/ui/Badge";
import { ChartContainer } from "@/components/ui/ChartContainer";
import { useAppStore } from "@/lib/store";
import { dashboardChartData, activityTimeline, CURRENT_CUSTOMER_ID } from "@/lib/mock-data";
import { formatNaira, formatDate, formatDateTime, getProgressPercent } from "@/lib/utils";

export default function CustomerDashboard() {
  const walletBalance = useAppStore((s) => s.walletBalance);
  const savingsAccounts = useAppStore((s) => s.savingsAccounts);
  const investments = useAppStore((s) => s.investments);
  const loanDrafts = useAppStore((s) => s.loanDrafts);
  const transactions = useAppStore((s) => s.transactions);

  const totalSavings = savingsAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalInvestments = investments.reduce((sum, i) => sum + i.amount, 0);
  const recentTxns = transactions.filter((t) => t.customerId === CURRENT_CUSTOMER_ID).slice(0, 5);
  const totalSpending = dashboardChartData.spendingBreakdown.reduce((s, i) => s + i.value, 0);

  return (
    <div className="space-y-6">
      {/* Welcome strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Your financial overview at a glance</p>
        </div>
        <div className="flex gap-2">
          <Link href="/customer/wallet"><Button size="sm" variant="outline"><Plus className="w-4 h-4" /> Add Fund</Button></Link>
          <Link href="/customer/loans/apply"><Button size="sm"><HandCoins className="w-4 h-4" /> Apply Loan</Button></Link>
        </div>
      </div>

      {/* Draft loans — prominent */}
      {loanDrafts.length > 0 && (
        <Card className="border-l-4 border-l-warning bg-gradient-to-r from-warning/5 to-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-xl bg-warning/10"><FileEdit className="w-5 h-5 text-warning" /></div>
            <div className="flex-1">
              <CardTitle>Draft Loan Applications</CardTitle>
              <p className="text-xs text-gray-400">Pick up where you left off</p>
            </div>
            <span className="text-xs bg-warning text-white px-2.5 py-1 rounded-full font-bold">{loanDrafts.length} incomplete</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {loanDrafts.map((draft) => {
              const progress = getProgressPercent(draft.step, draft.totalSteps);
              return (
                <Link key={draft.id} href={`/customer/loans/apply?product=${encodeURIComponent(draft.product)}&draft=${draft.id}`}>
                  <div className="bg-surface rounded-xl p-4 hover:shadow-card transition-all group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-semibold text-navy group-hover:text-cyan transition-colors">{draft.product}</span>
                      <span className="text-sm font-bold text-warning">{progress}%</span>
                    </div>
                    <div className="w-full bg-white rounded-full h-2 mb-2">
                      <div className="bg-gradient-to-r from-warning to-gold h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                    <p className="text-[11px] text-gray-400">Step {draft.step}/{draft.totalSteps} &middot; {formatDate(draft.lastUpdated)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* Stat cards row */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Savings" value={totalSavings} format="currency" featured icon={<PiggyBank className="w-6 h-6" />} trend={12} />
        <StatCard title="Wallet Balance" value={walletBalance} format="currency" icon={<Wallet className="w-5 h-5" />} iconBg="bg-cyan/10 text-cyan" trend={5.2} />
        <StatCard title="Investments" value={totalInvestments} format="currency" icon={<TrendingUp className="w-5 h-5" />} iconBg="bg-success/10 text-success" trend={12} />
        <StatCard title="Active Accounts" value={savingsAccounts.length + investments.length} format="number" icon={<ArrowUpRight className="w-5 h-5" />} iconBg="bg-navy/10 text-navy" />
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Virtual card + quick actions */}
        <div className="lg:col-span-4 space-y-4">
          <VirtualCard balance={walletBalance} />
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Add Fund", icon: Plus, href: "/customer/wallet", bg: "bg-success/10 text-success" },
              { label: "Transfer", icon: Send, href: "/customer/wallet", bg: "bg-cyan/10 text-cyan" },
              { label: "Save", icon: PiggyBank, href: "/customer/savings", bg: "bg-navy/10 text-navy" },
              { label: "Apply Loan", icon: HandCoins, href: "/customer/loans/apply", bg: "bg-warning/10 text-warning" },
            ].map((a) => (
              <Link key={a.label} href={a.href}>
                <div className="bg-white rounded-2xl p-4 shadow-card hover:shadow-card-hover transition-all text-center group">
                  <div className={`w-11 h-11 rounded-2xl ${a.bg} flex items-center justify-center mx-auto mb-2 group-hover:scale-105 transition-transform`}>
                    <a.icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-navy">{a.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Income chart */}
        <Card className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Income vs Expenses</CardTitle>
            <select className="text-xs px-3 py-1.5 rounded-lg bg-surface border-0 text-gray-500">
              <option>This Year</option>
            </select>
          </div>
          <ChartContainer height={240}>
            <BarChart data={dashboardChartData.monthlyIncome} width={700} height={240}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(v / 1000)}k`} />
              <Tooltip formatter={(v) => formatNaira(Number(v))} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
              <Bar dataKey="income" fill="#2FA4D7" radius={[6, 6, 0, 0]} name="Income" />
              <Bar dataKey="expense" fill="#1B2F6B" radius={[6, 6, 0, 0]} name="Expense" />
            </BarChart>
          </ChartContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Donut */}
        <Card className="lg:col-span-4">
          <CardTitle>Spending Breakdown</CardTitle>
          <div className="relative mt-4">
            <ChartContainer height={180}>
              <PieChart width={280} height={180}>
                <Pie data={dashboardChartData.spendingBreakdown} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} strokeWidth={0}>
                  {dashboardChartData.spendingBreakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-2xl font-bold text-navy">{totalSpending}%</p>
                <p className="text-[10px] text-gray-400">Total</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 mt-2">
            {dashboardChartData.spendingBreakdown.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-500">{item.name}</span>
                </div>
                <span className="font-semibold text-navy">{item.value}%</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Savings plans */}
        <Card className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Saving Plans</CardTitle>
            <Link href="/customer/savings"><Button variant="ghost" size="sm">View All <ChevronRight className="w-4 h-4" /></Button></Link>
          </div>
          <div className="space-y-5">
            {dashboardChartData.savingsPlans.map((plan) => {
              const pct = Math.round((plan.current / plan.target) * 100);
              return (
                <div key={plan.name}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-semibold text-navy">{plan.name}</span>
                    <span className="text-gray-400 text-xs">{formatNaira(plan.current)} / {formatNaira(plan.target)}</span>
                  </div>
                  <div className="w-full bg-surface rounded-full h-2.5">
                    <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${plan.color}, #2FA4D7)` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Transactions + Activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Recent Transactions</CardTitle>
            <Link href="/customer/transactions"><Button variant="ghost" size="sm">View All</Button></Link>
          </div>
          <div className="space-y-1">
            {recentTxns.map((txn) => (
              <div key={txn.id} className="flex items-center justify-between py-3 px-2 rounded-xl hover:bg-surface transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold ${txn.type === "credit" ? "bg-success/10 text-success" : "bg-navy/10 text-navy"}`}>
                    {txn.type === "credit" ? "+" : "−"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy">{txn.description}</p>
                    <p className="text-[11px] text-gray-400">{formatDate(txn.date)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${txn.type === "credit" ? "text-success" : "text-navy"}`}>
                    {txn.type === "credit" ? "+" : "-"}{formatNaira(txn.amount)}
                  </p>
                  <StatusBadge status={txn.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardTitle>Activity Timeline</CardTitle>
          <div className="mt-4 space-y-4 relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-gray-100" />
            {activityTimeline.map((item) => (
              <div key={item.id} className="flex gap-4 relative pl-1">
                <div className={`w-3.5 h-3.5 rounded-full mt-1 shrink-0 z-10 ring-2 ring-white ${item.type === "credit" ? "bg-success" : "bg-navy"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy">{item.action}</p>
                  <p className="text-[11px] text-gray-400">{formatDateTime(item.date)}</p>
                </div>
                <span className={`text-sm font-bold shrink-0 ${item.type === "credit" ? "text-success" : "text-navy"}`}>
                  {item.type === "credit" ? "+" : "-"}{formatNaira(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
