import { cn, formatNaira } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  trend?: number;
  icon?: React.ReactNode;
  primary?: boolean;
  format?: "currency" | "number" | "text";
}

export function KPICard({ title, value, trend, icon, primary = false, format = "text" }: KPICardProps) {
  const displayValue = format === "currency" && typeof value === "number" ? formatNaira(value) : value;

  if (primary) {
    return (
      <div className="gradient-navy rounded-2xl p-6 text-white card-shadow">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-white/70 text-sm font-medium">{title}</p>
            <p className="text-3xl font-bold mt-2">{displayValue}</p>
            {trend !== undefined && (
              <div className="flex items-center gap-1 mt-2">
                {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                <span className="text-sm">{Math.abs(trend)}% vs last month</span>
              </div>
            )}
          </div>
          {icon && <div className="p-3 bg-white/20 rounded-xl">{icon}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 card-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-500 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-navy mt-2">{displayValue}</p>
          {trend !== undefined && (
            <div className={cn("flex items-center gap-1 mt-2 text-sm", trend >= 0 ? "text-success" : "text-error")}>
              {trend >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        {icon && <div className="p-3 bg-bg-light rounded-xl text-cyan">{icon}</div>}
      </div>
    </div>
  );
}
