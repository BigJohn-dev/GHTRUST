"use client";

import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { RoleBadge, StatusBadge } from "@/components/ui/Badge";
import { staff } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

export default function AdminStaffPage() {
  const addToast = useAppStore((s) => s.addToast);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Staff & Users</h1>
          <p className="text-gray-500 text-sm">Manage staff accounts and role permissions</p>
        </div>
        <Button onClick={() => addToast("Add staff form opened", "info")}>Add Staff</Button>
      </div>

      <div className="grid sm:grid-cols-4 gap-4">
        {[
          { role: "teller", label: "Tellers" },
          { role: "loan_officer", label: "Loan Officers" },
          { role: "branch_manager", label: "Branch Managers" },
          { role: "admin", label: "Admins" },
        ].map((r) => (
          <Card key={r.role} className="text-center py-4">
            <p className="text-2xl font-bold text-navy">{staff.filter((s) => s.role === r.role).length}</p>
            <p className="text-xs text-gray-500">{r.label}</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Staff Directory</CardTitle>
        <DataTable
          data={staff}
          searchKey="name"
          searchPlaceholder="Search staff..."
          columns={[
            { key: "name", header: "Name", render: (s) => (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-cyan/10 flex items-center justify-center text-cyan text-xs font-bold">
                  {s.name.split(" ").map((n: string) => n[0]).join("")}
                </div>
                <div>
                  <p className="font-medium text-navy">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.email}</p>
                </div>
              </div>
            )},
            { key: "role", header: "Role", render: (s) => <RoleBadge role={s.role} /> },
            { key: "branch", header: "Branch" },
            { key: "lastLogin", header: "Last Login", render: (s) => formatDateTime(s.lastLogin) },
            { key: "status", header: "Status", render: (s) => <StatusBadge status={s.status} /> },
            { key: "actions", header: "", render: () => (
              <Button size="sm" variant="ghost" onClick={() => addToast("Staff profile opened", "info")}>Edit</Button>
            )},
          ]}
        />
      </Card>

      <Card>
        <CardTitle>Role Permissions</CardTitle>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-light text-left">
                <th className="px-4 py-3 font-semibold text-navy">Permission</th>
                <th className="px-4 py-3 font-semibold text-navy text-center">Teller</th>
                <th className="px-4 py-3 font-semibold text-navy text-center">Loan Officer</th>
                <th className="px-4 py-3 font-semibold text-navy text-center">Branch Manager</th>
                <th className="px-4 py-3 font-semibold text-navy text-center">Admin</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["View Customers", true, true, true, true],
                ["Approve Loans", false, true, true, true],
                ["Disburse Loans", false, false, true, true],
                ["Edit Products", false, false, false, true],
                ["Manage Staff", false, false, false, true],
                ["View Reports", false, true, true, true],
              ].map(([perm, ...roles]) => (
                <tr key={perm as string} className="border-t border-gray-50">
                  <td className="px-4 py-3 font-medium text-navy">{perm as string}</td>
                  {(roles as boolean[]).map((allowed, i) => (
                    <td key={i} className="px-4 py-3 text-center">{allowed ? "✅" : "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
