import { CustomerLayout } from "@/components/layouts/CustomerLayout";
import { StoreHydration } from "@/components/StoreHydration";
import { ToastContainer } from "@/components/ui/Toast";

// The customer demo reads a persisted client store, so it waits for hydration.
// The staff portal doesn't use that store and renders immediately.
export default function CustomerRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <StoreHydration>
      <div role="note" className="sticky top-0 z-[60] bg-warning px-4 py-1.5 text-center text-xs font-semibold text-white">
        Design demo with sample data — not connected to real accounts. Customers use the GH Trust mobile app.
      </div>
      <CustomerLayout>{children}</CustomerLayout>
      <ToastContainer />
    </StoreHydration>
  );
}
