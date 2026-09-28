"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { consumeSignOutRequest, useStaffAuth } from "@/lib/admin/auth";

/** Every page in this group requires a signed-in staff member. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { signedIn, loading, staff } = useStaffAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !signedIn) {
      // Expired session: come back here after signing in. Explicit sign-out: start fresh.
      router.replace(consumeSignOutRequest() ? "/admin/login" : `/admin/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, signedIn, pathname, router]);

  if (!signedIn || (loading && !staff)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy text-sm font-bold text-white shadow-card">GH</span>
          <span className="flex items-center gap-2 text-sm text-ink-3">
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-gray-200 border-t-cyan" aria-hidden />
            Checking your session…
          </span>
        </div>
      </div>
    );
  }
  return <AdminLayout>{children}</AdminLayout>;
}
