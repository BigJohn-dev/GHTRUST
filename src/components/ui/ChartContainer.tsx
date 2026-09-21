"use client";

import { useState, useEffect } from "react";

interface ChartContainerProps {
  children: React.ReactNode;
  height?: number;
  className?: string;
}

/** Prevents Recharts ResponsiveContainer infinite resize loops */
export function ChartContainer({ children, height = 260, className = "" }: ChartContainerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={`w-full bg-bg-light/50 rounded-xl animate-pulse ${className}`} style={{ height }} />;
  }

  return (
    <div className={`w-full ${className}`} style={{ height, minHeight: height }}>
      {children}
    </div>
  );
}
