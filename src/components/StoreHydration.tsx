"use client";

import { useEffect, useState } from "react";

export function StoreHydration({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-navy flex items-center justify-center text-white font-bold text-sm animate-pulse">GH</div>
          <p className="text-sm text-gray-500">Loading GH Trust...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
