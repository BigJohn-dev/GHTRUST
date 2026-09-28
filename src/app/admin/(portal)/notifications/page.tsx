"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/admin/Page";
import { NotLiveYet } from "@/components/admin/States";

const PLANNED = [
  { name: "OTP codes", detail: "Sign-in and registration codes by SMS", blocker: "Needs an SMS provider (Termii / Africa's Talking)" },
  { name: "Repayment reminders", detail: "Before and after each due date", blocker: "Due dates are tracked daily; needs SMS or push delivery" },
  { name: "Application updates", detail: "Approved, rejected, disbursed", blocker: "Needs SMS or push delivery" },
  { name: "Broadcasts", detail: "Messages to all or selected customers", blocker: "Needs a delivery provider and a broadcast API" },
];

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Notifications" description="Messages GH Trust sends to customers." meta={<Badge variant="muted">Not live</Badge>} />

      <NotLiveYet
        title="No notifications are being sent yet"
        detail="The backend has no SMS, email or push provider connected, so nothing is delivered and there is no notification history to show."
      />

      <Card flush className="mt-6">
        <div className="px-5 pt-5">
          <CardHeader title="What will be sent once a provider is connected" />
        </div>
        <ul className="divide-y divide-line border-t border-line">
          {PLANNED.map((p) => (
            <li key={p.name} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[220px_1fr_auto] sm:items-center sm:gap-4">
              <p className="text-sm font-medium text-ink">{p.name}</p>
              <p className="text-[13px] text-ink-3">{p.detail}</p>
              <Badge variant="warning" className="justify-self-start whitespace-normal sm:justify-self-end">
                {p.blocker}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
