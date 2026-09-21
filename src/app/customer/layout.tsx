import { CustomerLayout } from "@/components/layouts/CustomerLayout";

export default function CustomerRootLayout({ children }: { children: React.ReactNode }) {
  return <CustomerLayout>{children}</CustomerLayout>;
}
