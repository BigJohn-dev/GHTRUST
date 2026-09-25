"use client";

import { StaffAuthProvider } from "@/lib/admin/auth";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <StaffAuthProvider>{children}</StaffAuthProvider>;
}
