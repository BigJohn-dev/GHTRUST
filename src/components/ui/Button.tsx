import Link from "next/link";
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/admin/motion";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "danger-outline";
  size?: "xs" | "sm" | "md" | "lg" | "icon";
  /** Shows a spinner and disables the button while an action runs. */
  loading?: boolean;
}

// Solid variants get a light sweep on hover (see `sheen` below).
const SOLID = new Set(["primary", "secondary", "danger", "success"]);

const variants = {
  primary: "bg-navy text-white shadow-xs hover:bg-navy-700 active:bg-navy-900",
  secondary: "bg-cyan text-white shadow-xs hover:bg-[#08618B]",
  outline: "border border-line-strong bg-white text-ink-2 shadow-xs hover:bg-gray-50 hover:text-ink",
  ghost: "text-ink-2 hover:bg-gray-100 hover:text-ink",
  danger: "bg-error text-white shadow-xs hover:bg-[#A62B09]",
  "danger-outline": "border border-error/30 bg-white text-error shadow-xs hover:bg-error-soft",
  success: "bg-success text-white shadow-xs hover:bg-[#05603A]",
};

const sizes = {
  xs: "h-7 gap-1.5 rounded-md px-2.5 text-xs",
  sm: "h-8 gap-1.5 rounded-lg px-3 text-[13px]",
  md: "h-9 gap-2 rounded-lg px-4 text-sm",
  lg: "h-11 gap-2 rounded-lg px-5 text-sm",
  icon: "h-8 w-8 rounded-lg",
};

type Variant = NonNullable<ButtonProps["variant"]>;
type Size = NonNullable<ButtonProps["size"]>;

const base =
  "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-semibold " +
  "transition-[background-color,color,box-shadow,transform] duration-150 active:scale-[0.98]";

/** Classes for anything that should look like a button (e.g. a link). */
export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

/** A navigation link styled as a button — not a <button> nested in an <a>. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: { href: string; variant?: Variant; size?: Size } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, type = "button", onClick, ...props },
  ref,
) {
  const solid = SOLID.has(variant);
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        base,
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        solid && "group/btn relative overflow-hidden",
        className,
      )}
      onClick={(e) => {
        if (solid) haptic();
        onClick?.(e);
      }}
      {...props}
    >
      {solid && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-1/3 -translate-x-[120%] bg-gradient-to-r from-transparent via-white/25 to-transparent group-hover/btn:animate-sheen"
        />
      )}
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
