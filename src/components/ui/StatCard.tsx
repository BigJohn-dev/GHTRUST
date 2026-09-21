import { cn, formatNaira } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon: React.ReactNode;
  iconBg?: string;
  format?: "currency" | "number" | "text";
  featured?: boolean;
}

export function StatCard({ title, value, trend, icon, iconBg = "bg-cyan/10 text-cyan", format = "text", featured = false }: StatCardProps) {
  const display = format === "currency" && typeof value === "number" ? formatNaira(value) : value;

  if (featured) {
    return (
      <div className="relative overflow-hidden rounded-2xl gradient-navy p-6 text-white shadow-card">
        <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold mt-2 tracking-tight">{display}</p>
            {trend !== undefined && (
              <p className="text-white/80 text-sm mt-2 flex items-center gap-1">
                {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {Math.abs(trend)}% vs last month
              </p>
            )}
          </div>
          <div className="p-3 rounded-2xl bg-white/15 backdrop-blur">{icon}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-card border border-white hover:shadow-card-hover transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-navy mt-1 tracking-tight">{display}</p>
          {trend !== undefined && (
            <p className={cn("text-xs mt-2 flex items-center gap-1 font-medium", trend >= 0 ? "text-success" : "text-error")}>
              {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {Math.abs(trend)}%
            </p>
          )}
        </div>
        <div className={cn("p-3 rounded-2xl", iconBg)}>{icon}</div>
      </div>
    </div>
  );
}
