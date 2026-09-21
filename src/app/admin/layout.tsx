import { AdminLayout } from "@/components/layouts/AdminLayout";

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
