"use client";

import { Users, Calendar, Target } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import { groupThrifts, groupContributions } from "@/lib/mock-data";
import { formatNaira, formatDate } from "@/lib/utils";

export default function GroupThriftPage() {
  const addToast = useAppStore((s) => s.addToast);
  const myGroups = groupThrifts.filter((g) => g.leader === "Adaeze Okafor" || g.name.includes("Lagos"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Group Thrift</h1>
          <p className="text-gray-500 text-sm">Community savings and cooperative contributions</p>
        </div>
        <Button onClick={() => addToast("Group creation request submitted", "info")}>Join a Group</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {myGroups.map((group) => {
          const progress = Math.round((group.collectedAmount / group.targetAmount) * 100);
          const contributions = groupContributions.filter((c) => c.groupId === group.id);
          return (
            <Card key={group.id}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan/10 rounded-xl"><Users className="w-6 h-6 text-cyan" /></div>
                  <div>
                    <h3 className="font-bold text-navy">{group.name}</h3>
                    <p className="text-xs text-gray-500">Led by {group.leader}</p>
                  </div>
                </div>
                <StatusBadge status={group.status} />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                <div className="bg-bg-light rounded-lg p-3">
                  <p className="text-xs text-gray-500">Members</p>
                  <p className="font-bold text-navy">{group.members}</p>
                </div>
                <div className="bg-bg-light rounded-lg p-3">
                  <p className="text-xs text-gray-500">Cycle</p>
                  <p className="font-bold text-navy">#{group.cycle}</p>
                </div>
                <div className="bg-bg-light rounded-lg p-3">
                  <p className="text-xs text-gray-500">Branch</p>
                  <p className="font-bold text-navy text-xs">{group.branch}</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500 flex items-center gap-1"><Target className="w-3 h-3" /> Collection Progress</span>
                  <span className="font-bold text-navy">{progress}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className="bg-cyan h-3 rounded-full" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">{formatNaira(group.collectedAmount)} of {formatNaira(group.targetAmount)}</p>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                <Calendar className="w-4 h-4 text-cyan" />
                Next meeting: {formatDate(group.nextMeeting)}
              </div>

              <Button size="sm" className="w-full mb-4" onClick={() => addToast("Contribution of ₦50,000 recorded", "success")}>
                Make Contribution
              </Button>

              {contributions.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-navy mb-2">Recent Contributions</p>
                  {contributions.slice(0, 3).map((c) => (
                    <div key={c.id} className="flex justify-between text-sm py-1.5 border-t border-gray-50">
                      <span className="text-gray-600">{c.memberName}</span>
                      <span className="font-medium text-navy">{formatNaira(c.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
