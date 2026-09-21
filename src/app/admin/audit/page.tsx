"use client";

import { useState } from "react";
import { ClipboardList, Filter } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { RoleBadge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { formatDateTime } from "@/lib/utils";

export default function AdminAuditPage() {
  const auditLogs = useAppStore((s) => s.auditLogs);
  const [roleFilter, setRoleFilter] = useState("all");

  const filtered = roleFilter === "all" ? auditLogs : auditLogs.filter((l) => l.role === roleFilter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Audit Log</h1>
          <p className="text-gray-500 text-sm">Complete trail of system actions</p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/30">
            <option value="all">All Roles</option>
            <option value="teller">Teller</option>
            <option value="loan_officer">Loan Officer</option>
            <option value="branch_manager">Branch Manager</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      <Card>
        <CardTitle>Activity Timeline</CardTitle>
        <div className="mt-6 relative">
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-100" />
          <div className="space-y-6">
            {filtered.map((log) => (
              <div key={log.id} className="flex gap-4 relative pl-10">
                <div className="absolute left-2.5 w-3 h-3 rounded-full bg-cyan border-2 border-white" />
                <div className="flex-1 bg-bg-light rounded-xl p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="w-4 h-4 text-navy" />
                      <span className="font-semibold text-navy">{log.action}</span>
                    </div>
                    <RoleBadge role={log.role} />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{log.details}</p>
                  <div className="flex flex-wrap gap-4 mt-2 text-xs text-gray-400">
                    <span>By: {log.user}</span>
                    <span>{formatDateTime(log.timestamp)}</span>
                    <span>IP: {log.ip}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
