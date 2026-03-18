import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  variant?: "default" | "success" | "warning" | "danger";
  delta?: string;
  deltaUp?: boolean;
}

const variantIcon: Record<NonNullable<StatsCardProps["variant"]>, string> = {
  default: "bg-[#5e6ad2]/10 text-[#5e6ad2]",
  success: "bg-emerald-500/10 text-emerald-400",
  warning: "bg-amber-500/10 text-amber-400",
  danger:  "bg-rose-500/10 text-rose-400",
};

const variantValue: Record<NonNullable<StatsCardProps["variant"]>, string> = {
  default: "text-[#ededef]",
  success: "text-emerald-400",
  warning: "text-amber-400",
  danger:  "text-rose-400",
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
  delta,
  deltaUp,
}: StatsCardProps): React.JSX.Element {
  return (
    <Card className="py-0">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", variantIcon[variant])}>
            <Icon className="h-4 w-4" />
          </div>
          {delta && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[11px] font-medium",
                deltaUp ? "text-emerald-400" : "text-rose-400",
              )}
            >
              {deltaUp
                ? <TrendingUp className="h-3 w-3" />
                : <TrendingDown className="h-3 w-3" />
              }
              {delta}
            </span>
          )}
        </div>

        <div className="mt-3">
          <div className={cn("text-2xl font-semibold tracking-tight tabular-nums", variantValue[variant])}>
            {value}
          </div>
          <div className="mt-0.5 text-xs text-[#6b7080]">{title}</div>
          {description && (
            <div className="mt-1 text-[11px] text-[#6b7080]/60">{description}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
