import { cn } from "@/lib/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  /** Removes the inner padding, e.g. for edge-to-edge tables. */
  flush?: boolean;
}

export function Card({ children, className, onClick, flush = false }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-white shadow-card",
        !flush && "p-5",
        onClick && "cursor-pointer transition-shadow hover:shadow-card-hover",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

/** Title row for a card: title, optional description, and right-aligned actions. */
export function CardHeader({
  title,
  description,
  actions,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  if (children && !title) return <div className={cn("mb-4", className)}>{children}</div>;
  return (
    <div className={cn("mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2", className)}>
      <div className="min-w-0">
        <CardTitle>{title}</CardTitle>
        {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-[15px] font-semibold text-ink", className)}>{children}</h3>;
}
