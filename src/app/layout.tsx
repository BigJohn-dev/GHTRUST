import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/ui/Toast";
import { StoreHydration } from "@/components/StoreHydration";

export const metadata: Metadata = {
  title: "GH Trust International Ltd | Secure Today. Grow Tomorrow.",
  description: "Nigerian Microfinance Bank - Customer & Admin Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <StoreHydration>
          {children}
        </StoreHydration>
        <ToastContainer />
      </body>
    </html>
  );
}
