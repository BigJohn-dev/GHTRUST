"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Children stay hidden until this block scrolls into view, then enter one after
 * another (the `.stagger` animation). Plays once. With reduced motion, or without
 * IntersectionObserver, content simply shows.
 */
export function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn(className, shown ? "stagger" : "[&>*]:opacity-0 motion-reduce:[&>*]:opacity-100")}>
      {children}
    </div>
  );
}
