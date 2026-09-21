"use client";

import { Bell, CheckCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";

const typeColors = { info: "info", success: "success", warning: "warning", error: "error" } as const;

export default function NotificationsPage() {
  const notifications = useAppStore((s) => s.customerNotifications);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);

  const markAllRead = () => notifications.filter((n) => !n.read).forEach((n) => markNotificationRead(n.id, "customer"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Notifications</h1>
          <p className="text-gray-500 text-sm">{notifications.filter((n) => !n.read).length} unread</p>
        </div>
        <Button variant="outline" size="sm" onClick={markAllRead}><CheckCheck className="w-4 h-4" /> Mark all read</Button>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => (
          <Card key={n.id} className={`${!n.read ? "border-l-4 border-l-cyan" : "opacity-70"}`}>
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-xl ${n.type === "warning" ? "bg-warning/10" : n.type === "success" ? "bg-success/10" : "bg-cyan/10"}`}>
                <Bell className={`w-5 h-5 ${n.type === "warning" ? "text-warning" : n.type === "success" ? "text-success" : "text-cyan"}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-navy">{n.title}</h3>
                  <Badge variant={typeColors[n.type]}>{n.type}</Badge>
                  {!n.read && <span className="w-2 h-2 bg-cyan rounded-full" />}
                </div>
                <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                <p className="text-xs text-gray-400 mt-2">{formatDate(n.date)}</p>
              </div>
              {!n.read && (
                <Button size="sm" variant="ghost" onClick={() => markNotificationRead(n.id, "customer")}>Read</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
