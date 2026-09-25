"use client";

import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from "recharts";
import {
  HandCoins, PiggyBank, Users, AlertTriangle, FileText, ChevronRight,
  UserPlus, Trophy,
} from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/Badge";
import { ChartContainer } from "@/components/ui/ChartContainer";
import { useAppStore } from "@/lib/store";
import { dashboardChartData, customers, staff } from "@/lib/mock-data";
import { formatNaira } from "@/lib/utils";

function RingProgress({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  const r = 22;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative w-14 h-14">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#EEF2F9" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-navy">{pct}%</span>
    </div>
  );
}

export default function AdminDashboard() {
  const { adminKPIs, adminMonthlyData, adminLoanDistribution } = dashboardChartData;
  const applications = useAppStore((s) => s.loanApplications);
  const pending = applications.filter((a) => a.status === "pending" || a.status === "under_review");

  const pipeline = [
    { label: "Pending Review", count: applications.filter((a) => a.status === "pending").length, max: 10, color: "#2FA4D7", icon: FileText },
    { label: "Under Review", count: applications.filter((a) => a.status === "under_review").length, max: 8, color: "#E5AF59", icon: HandCoins },
    { label: "Approved", count: applications.filter((a) => a.status === "approved").length, max: 5, color: "#00A86B", icon: Trophy },
    { label: "Overdue", count: 1, max: 3, color: "#CF2E2E", icon: AlertTriangle },
  ];

  const calendarDays = Array.from({ length: 31 }, (_, i) => i + 1);
  const highlighted = [5, 12, 18, 20, 25];

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="rounded-2xl gradient-navy p-6 lg:p-8 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Hello, Ngozi! 👋</h1>
            <p className="text-white/70 mt-1 text-sm">
              You have <strong className="text-white">{pending.length} loan applications</strong> awaiting your review.
            </p>
          </div>
          <Link href="/admin/loan-applications">
            <Button className="bg-white text-navy hover:bg-white/90 shadow-lg">
              Review Applications <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI row — Schoooli-style stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Disbursed" value={adminKPIs.totalDisbursed} format="currency" featured icon={<HandCoins className="w-6 h-6" />} trend={adminKPIs.totalDisbursedTrend} />
        <StatCard title="Pending Approvals" value={adminKPIs.pendingApprovals} format="number" icon={<FileText className="w-5 h-5" />} iconBg="bg-warning/10 text-warning" trend={adminKPIs.pendingApprovalsTrend} />
        <StatCard title="Total Deposits" value={adminKPIs.totalDeposits} format="currency" icon={<PiggyBank className="w-5 h-5" />} iconBg="bg-cyan/10 text-cyan" trend={adminKPIs.totalDepositsTrend} />
        <StatCard title="Overdue Loans" value={adminKPIs.overdueLoans} format="number" icon={<AlertTriangle className="w-5 h-5" />} iconBg="bg-error/10 text-error" trend={adminKPIs.overdueLoansTrend} />
        <StatCard title="New Customers" value={adminKPIs.newCustomers} format="number" icon={<Users className="w-5 h-5" />} iconBg="bg-navy/10 text-navy" trend={adminKPIs.newCustomersTrend} />
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Pipeline rings */}
        <Card className="lg:col-span-4">
          <CardTitle>Loan Pipeline</CardTitle>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {pipeline.map((m) => (
              <div key={m.label} className="bg-surface rounded-xl p-3 flex items-center gap-3">
                <RingProgress value={m.count} max={m.max} color={m.color} />
                <div>
                  <p className="text-xl font-bold text-navy">{m.count}</p>
                  <p className="text-[10px] text-gray-400 leading-tight">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Application pipeline table */}
        <Card className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <CardTitle>Application Pipeline</CardTitle>
              <p className="text-[11px] text-gray-400 mt-0.5">Recent loan applications</p>
            </div>
            <Link href="/admin/loan-applications"><Button variant="ghost" size="sm">View All</Button></Link>
          </div>
          <div className="space-y-1">
            {pending.slice(0, 5).map((app) => (
              <div key={app.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-surface transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-navy/10 to-cyan/10 flex items-center justify-center text-navy text-xs font-bold">
                    {app.customerName.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-navy text-sm">{app.customerName}</p>
                    <p className="text-[11px] text-gray-400">{app.product} &middot; {formatNaira(app.amount)}</p>
                  </div>
                </div>
                <StatusBadge status={app.status} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        {/* Monthly chart */}
        <Card className="lg:col-span-8">
          <div className="flex items-center justify-between mb-4">
            <CardTitle>Monthly Performance</CardTitle>
            <select className="text-xs px-3 py-1.5 rounded-lg bg-surface border-0 text-gray-500">
              <option>2025</option>
            </select>
          </div>
          <ChartContainer height={260}>
            <BarChart data={adminMonthlyData} width={700} height={260}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F9" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₦${(Number(v) / 1000000).toFixed(0)}M`} />
              <Tooltip formatter={(v) => formatNaira(Number(v))} contentStyle={{ borderRadius: 12, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }} />
              <Bar dataKey="disbursed" fill="#1B2F6B" radius={[6, 6, 0, 0]} name="Disbursed" />
              <Bar dataKey="deposits" fill="#2FA4D7" radius={[6, 6, 0, 0]} name="Deposits" />
              <Bar dataKey="repayments" fill="#00A86B" radius={[6, 6, 0, 0]} name="Repayments" />
            </BarChart>
          </ChartContainer>
        </Card>

        {/* Calendar + signups */}
        <div className="lg:col-span-4 space-y-6">
          <Card>
            <CardTitle>Disbursement Calendar</CardTitle>
            <p className="text-[11px] text-gray-400 mb-3">July 2025</p>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <span key={`${d}-${i}`} className="text-gray-300 font-medium py-1">{d}</span>
              ))}
              {calendarDays.map((day) => (
                <span key={day} className={`py-1.5 rounded-lg transition-colors ${highlighted.includes(day) ? "bg-cyan text-white font-bold" : "text-gray-500 hover:bg-surface"}`}>
                  {day}
                </span>
              ))}
            </div>
          </Card>

          <Card>
            <CardTitle>Recent Signups</CardTitle>
            <div className="space-y-3 mt-3">
              {customers.slice(3, 6).map((c) => (
                <div key={c.id} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-navy/10 flex items-center justify-center">
                      <UserPlus className="w-3.5 h-3.5 text-navy" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-navy">{c.name}</p>
                      <p className="text-[10px] text-gray-400">{c.branch}</p>
                    </div>
                  </div>
                  <Link href={`/admin/customers/${c.id}`} className="text-[11px] text-cyan font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                    View
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Donut distribution */}
        <Card>
          <CardTitle>Loan Distribution</CardTitle>
          <div className="flex items-center mt-4 gap-6">
            <ChartContainer height={160} className="w-40">
              <PieChart width={160} height={160}>
                <Pie data={adminLoanDistribution} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} strokeWidth={0}>
                  {adminLoanDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="space-y-3 flex-1">
              {adminLoanDistribution.map((item) => (
                <div key={item.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500">{item.name}</span>
                    <span className="font-bold text-navy">{item.value}%</span>
                  </div>
                  <div className="w-full bg-surface rounded-full h-2">
                    <div className="h-2 rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Staff online */}
        <Card>
          <CardTitle>Staff Online</CardTitle>
          <div className="space-y-2 mt-4">
            {staff.filter((s) => s.status === "active").slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 px-2 rounded-xl hover:bg-surface transition-colors">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-9 h-9 rounded-xl bg-cyan/10 flex items-center justify-center text-cyan text-xs font-bold">
                      {s.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full ring-2 ring-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-navy">{s.name}</p>
                    <p className="text-[10px] text-gray-400">{s.branch}</p>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400 capitalize bg-surface px-2 py-1 rounded-lg">{s.role.replace(/_/g, " ")}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
