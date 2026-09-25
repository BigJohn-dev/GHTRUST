"use client";

import { Users } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/Badge";
import { groupThrifts } from "@/lib/mock-data";
import { formatNaira, formatDate } from "@/lib/utils";
import { useAppStore } from "@/lib/store";

export default function AdminGroupThriftPage() {
  const addToast = useAppStore((s) => s.addToast);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Group Thrift</h1>
          <p className="text-gray-500 text-sm">Manage cooperative savings groups</p>
        </div>
        <Button onClick={() => addToast("New group creation form opened", "info")}>Create Group</Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Card className="text-center py-4"><p className="text-2xl font-bold text-navy">{groupThrifts.length}</p><p className="text-xs text-gray-500">Total Groups</p></Card>
        <Card className="text-center py-4"><p className="text-2xl font-bold text-success">{groupThrifts.filter((g) => g.status === "active").length}</p><p className="text-xs text-gray-500">Active</p></Card>
        <Card className="text-center py-4"><p className="text-2xl font-bold text-cyan">{formatNaira(groupThrifts.reduce((s, g) => s + g.collectedAmount, 0))}</p><p className="text-xs text-gray-500">Total Collected</p></Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {groupThrifts.map((group) => {
          const progress = Math.round((group.collectedAmount / group.targetAmount) * 100);
          return (
            <Card key={group.id}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-cyan/10 rounded-lg"><Users className="w-5 h-5 text-cyan" /></div>
                  <div>
                    <h3 className="font-bold text-navy">{group.name}</h3>
                    <p className="text-xs text-gray-500">Leader: {group.leader} &middot; {group.members} members</p>
                  </div>
                </div>
                <StatusBadge status={group.status} />
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1"><span className="text-gray-500">Progress</span><span className="font-bold">{progress}%</span></div>
                <div className="w-full bg-gray-100 rounded-full h-2"><div className="bg-cyan h-2 rounded-full" style={{ width: `${progress}%` }} /></div>
                <p className="text-xs text-gray-500 mt-1">{formatNaira(group.collectedAmount)} / {formatNaira(group.targetAmount)}</p>
              </div>
              <p className="text-xs text-gray-400 mt-3">Cycle #{group.cycle} &middot; Next meeting: {formatDate(group.nextMeeting)} &middot; {group.branch}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardTitle>Group Registry</CardTitle>
        <DataTable
          data={groupThrifts}
          searchKey="name"
          searchPlaceholder="Search groups..."
          columns={[
            { key: "name", header: "Group Name" },
            { key: "leader", header: "Leader" },
            { key: "members", header: "Members" },
            { key: "collectedAmount", header: "Collected", render: (g) => formatNaira(g.collectedAmount) },
            { key: "targetAmount", header: "Target", render: (g) => formatNaira(g.targetAmount) },
            { key: "branch", header: "Branch" },
            { key: "status", header: "Status", render: (g) => <StatusBadge status={g.status} /> },
          ]}
        />
      </Card>
    </div>
  );
}
