"use client";

import { Timer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useStaffAuth } from "@/lib/admin/auth";
import { IDLE_WARNING_MS } from "@/lib/admin/session";

/** "Still there?" countdown before an inactivity sign-out. */
export function IdleWarning() {
  const { idleWarningMs, stayActive, signOut } = useStaffAuth();
  const open = idleWarningMs !== null;
  const secondsLeft = Math.max(0, Math.ceil((idleWarningMs ?? 0) / 1000));
  const pct = Math.min(100, Math.max(0, ((idleWarningMs ?? 0) / IDLE_WARNING_MS) * 100));

  return (
    <Modal
      isOpen={open}
      onClose={stayActive}
      title="Still there?"
      size="sm"
      footer={
        <>
          <Button variant="outline" onClick={() => void signOut("idle")}>
            Sign out now
          </Button>
          <Button onClick={stayActive}>Stay signed in</Button>
        </>
      }
    >
      <div className="flex items-center gap-4">
        <div className="relative h-14 w-14 shrink-0" aria-hidden>
          <svg viewBox="0 0 36 36" className="h-14 w-14 -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#EAECF0" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="#0A74A6"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * 97.4} 97.4`}
              className="transition-[stroke-dasharray] duration-1000 ease-linear"
            />
          </svg>
          <Timer className="absolute inset-0 m-auto h-5 w-5 text-cyan" />
        </div>
        <p className="text-sm text-ink-2" role="timer" aria-live="polite">
          For security, you&apos;ll be signed out in <strong className="num text-ink">{secondsLeft}s</strong> because there
          hasn&apos;t been any activity for a while.
        </p>
      </div>
    </Modal>
  );
}
