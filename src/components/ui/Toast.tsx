"use client";

import { useAppStore } from "@/lib/store";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertCircle,
  info: Info,
};

const colors = {
  success: "bg-green-50 border-success text-success",
  error: "bg-red-50 border-error text-error",
  warning: "bg-amber-50 border-warning text-warning",
  info: "bg-blue-50 border-cyan text-cyan",
};

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts);
  const removeToast = useAppStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg animate-in slide-in-from-right",
              colors[toast.type]
            )}
          >
            <Icon className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium flex-1 text-navy">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="shrink-0 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
