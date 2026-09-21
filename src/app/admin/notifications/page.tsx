"use client";

import { useState } from "react";
import { Bell, Send } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { useAppStore } from "@/lib/store";
import { formatDate } from "@/lib/utils";

const typeColors = { info: "info", success: "success", warning: "warning", error: "error" } as const;

export default function AdminNotificationsPage() {
  const notifications = useAppStore((s) => s.adminNotifications);
  const markNotificationRead = useAppStore((s) => s.markNotificationRead);
  const addToast = useAppStore((s) => s.addToast);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Notifications</h1>
          <p className="text-gray-500 text-sm">System alerts and broadcast messaging</p>
        </div>
        <Button onClick={() => setBroadcastOpen(true)}><Send className="w-4 h-4" /> Send Broadcast</Button>
      </div>

      <div className="space-y-3">
        {notifications.map((n) => (
          <Card key={n.id} className={!n.read ? "border-l-4 border-l-cyan" : "opacity-70"}>
            <div className="flex items-start gap-4">
              <div className={`p-2 rounded-xl ${n.type === "error" ? "bg-error/10" : n.type === "warning" ? "bg-warning/10" : "bg-cyan/10"}`}>
                <Bell className={`w-5 h-5 ${n.type === "error" ? "text-error" : n.type === "warning" ? "text-warning" : "text-cyan"}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-navy">{n.title}</h3>
                  <Badge variant={typeColors[n.type]}>{n.type}</Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1">{n.message}</p>
                <p className="text-xs text-gray-400 mt-2">{formatDate(n.date)}</p>
              </div>
              {!n.read && <Button size="sm" variant="ghost" onClick={() => markNotificationRead(n.id, "admin")}>Mark read</Button>}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CardTitle>Notification Templates</CardTitle>
        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          {[
            { name: "Loan Payment Reminder", desc: "Sent 3 days before due date" },
            { name: "KYC Verification", desc: "Triggered on new registration" },
            { name: "Disbursement Confirmation", desc: "Sent after loan disbursement" },
            { name: "Overdue Alert", desc: "Sent when payment is 7+ days late" },
          ].map((t) => (
            <div key={t.name} className="bg-bg-light rounded-xl p-4 flex justify-between items-center">
              <div>
                <p className="font-medium text-navy text-sm">{t.name}</p>
                <p className="text-xs text-gray-500">{t.desc}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => addToast(`Template "${t.name}" preview sent`, "info")}>Preview</Button>
            </div>
          ))}
        </div>
      </Card>

      <Modal isOpen={broadcastOpen} onClose={() => setBroadcastOpen(false)} title="Send Broadcast"
        footer={<><Button variant="ghost" onClick={() => setBroadcastOpen(false)}>Cancel</Button><Button onClick={() => { addToast("Broadcast sent to all customers", "success"); setBroadcastOpen(false); setBroadcastMsg(""); }}>Send</Button></>}>
        <textarea value={broadcastMsg} onChange={(e) => setBroadcastMsg(e.target.value)} rows={4} placeholder="Enter broadcast message..." className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-cyan/30" />
        <p className="text-xs text-gray-400 mt-2">Will be sent via SMS and push notification to all active customers.</p>
      </Modal>
    </div>
  );
}
