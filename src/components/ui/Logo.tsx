import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
  light?: boolean;
}

export function Logo({ size = "md", showTagline = false, light = false }: LogoProps) {
  const sizes = { sm: "text-lg", md: "text-xl", lg: "text-2xl" };
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg gradient-navy flex items-center justify-center ${size === "lg" ? "w-10 h-10" : ""}`}>
          <span className="text-white font-bold text-sm">GH</span>
        </div>
        <div>
          <span className={`font-bold ${sizes[size]} ${light ? "text-white" : "text-navy"}`}>
            GH Trust
          </span>
          {size !== "sm" && (
            <span className={`text-xs block ${light ? "text-white/70" : "text-gray-500"}`}>
              International Ltd
            </span>
          )}
        </div>
      </div>
      {showTagline && (
        <p className={`text-xs mt-1 ${light ? "text-white/60" : "text-cyan"}`}>
          Secure Today. Grow Tomorrow.
        </p>
      )}
    </div>
  );
}

export function LogoLink({ href = "/", ...props }: LogoProps & { href?: string }) {
  return (
    <Link href={href}>
      <Logo {...props} />
    </Link>
  );
}
