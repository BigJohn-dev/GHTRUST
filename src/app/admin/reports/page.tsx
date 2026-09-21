"use client";

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { Card, CardTitle } from "@/components/ui/Card";
import { dashboardChartData, loans, customers } from "@/lib/mock-data";
import { formatNaira } from "@/lib/utils";

export default function AdminReportsPage() {
  const branchData = [
    { branch: "Lagos Main", deposits: 18500000, loans: 3200000, customers: 45 },
    { branch: "Lagos Ikeja", deposits: 12200000, loans: 1800000, customers: 32 },
    { branch: "Akure Central", deposits: 8900000, loans: 1500000, customers: 28 },
    { branch: "Akure Oba Road", deposits: 6200000, loans: 730000, customers: 19 },
  ];

  const productPerformance = [
    { product: "Yearly Thrift", accounts: 120, volume: 15000000 },
    { product: "Regular Savings", accounts: 85, volume: 8500000 },
    { product: "Fixed Savings", accounts: 42, volume: 12000000 },
    { product: "Business Loan", accounts: loans.filter((l) => l.product === "Business Loan").length, volume: 5500000 },
    { product: "Payday Loan", accounts: loans.filter((l) => l.product === "Payday Loan").length, volume: 230000 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Reports</h1>
        <p className="text-gray-500 text-sm">Portfolio analytics and branch performance</p>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        <Card className="py-4 px-6"><p className="text-xs text-gray-500">Total Customers</p><p className="text-2xl font-bold text-navy">{customers.length}</p></Card>
        <Card className="py-4 px-6"><p className="text-xs text-gray-500">Loan Book</p><p className="text-2xl font-bold text-navy">{formatNaira(loans.reduce((s, l) => s + l.outstanding, 0))}</p></Card>
        <Card className="py-4 px-6"><p className="text-xs text-gray-500">Total Deposits</p><p className="text-2xl font-bold text-cyan">{formatNaira(dashboardChartData.adminKPIs.totalDeposits)}</p></Card>
        <Card className="py-4 px-6"><p className="text-xs text-gray-500">PAR (Overdue)</p><p className="text-2xl font-bold text-error">1.4%</p></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Monthly Disbursements vs Deposits</CardTitle>
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboardChartData.adminMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9F8F9" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `₦${(v / 1000000).toFixed(0)}M`} />
                <Tooltip formatter={(v) => formatNaira(Number(v))} />
                <Bar dataKey="disbursed" fill="#1B2F6B" name="Disbursed" radius={[4, 4, 0, 0]} />
                <Bar dataKey="deposits" fill="#2FA4D7" name="Deposits" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitle>Repayment Trend</CardTitle>
          <div className="h-72 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dashboardChartData.adminMonthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E9F8F9" />
                <XAxis dataKey="month" />
                <YAxis tickFormatter={(v) => `₦${(v / 1000000).toFixed(1)}M`} />
                <Tooltip formatter={(v) => formatNaira(Number(v))} />
                <Line type="monotone" dataKey="repayments" stroke="#00A86B" strokeWidth={3} dot={{ fill: "#00A86B" }} name="Repayments" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardTitle>Branch Performance</CardTitle>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead><tr className="bg-bg-light text-left"><th className="px-4 py-3 font-semibold text-navy">Branch</th><th className="px-4 py-3 font-semibold text-navy">Deposits</th><th className="px-4 py-3 font-semibold text-navy">Loans</th><th className="px-4 py-3 font-semibold text-navy">Customers</th></tr></thead>
              <tbody>
                {branchData.map((b) => (
                  <tr key={b.branch} className="border-t border-gray-50">
                    <td className="px-4 py-3 font-medium text-navy">{b.branch}</td>
                    <td className="px-4 py-3">{formatNaira(b.deposits)}</td>
                    <td className="px-4 py-3">{formatNaira(b.loans)}</td>
                    <td className="px-4 py-3">{b.customers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardTitle>Product Performance</CardTitle>
          <div className="h-48 mt-4 flex items-center">
            <ResponsiveContainer width="50%" height="100%">
              <PieChart>
                <Pie data={dashboardChartData.adminLoanDistribution} dataKey="value" cx="50%" cy="50%" outerRadius={70}>
                  {dashboardChartData.adminLoanDistribution.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 flex-1">
              {productPerformance.map((p) => (
                <div key={p.product} className="flex justify-between text-sm">
                  <span className="text-gray-600">{p.product}</span>
                  <span className="font-medium text-navy">{p.accounts} accts</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
