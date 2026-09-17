import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "neutral";
type Tint = "blue" | "sky" | "amber" | "green" | "rose" | "violet";

interface KpiCardProps {
  label: string;
  value: number | string;
  delta?: { value: string; label?: string; direction?: Direction };
  icon?: React.ComponentType<{ className?: string }>;
  format?: "number" | "currency" | "percent" | "multiplier" | "raw";
  loading?: boolean;
  className?: string;
  accentColor?: string;
  tint?: Tint;
}

function formatValue(value: number | string, format: KpiCardProps["format"] = "number"): string {
  if (typeof value === "string") return value;
  if (format === "currency") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  if (format === "percent") return `${(value * 100).toFixed(0)}%`;
  if (format === "multiplier") return `${value.toFixed(1)}×`;
  if (format === "raw") return String(value);
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function KpiCard({ label, value, delta, icon: Icon, format = "number", loading = false, className, accentColor, tint = "blue" }: KpiCardProps) {
  const direction = delta?.direction ?? "neutral";
  const deltaColor = direction === "up" ? "text-emerald-600" : direction === "down" ? "text-rose-600" : "text-muted-foreground";
  const deltaChip = direction === "up" ? "bg-emerald-50" : direction === "down" ? "bg-rose-50" : "bg-muted";
  const DeltaIcon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : null;

  return (
    <div className={cn(
      "card-lift group relative rounded-2xl border border-border/70 bg-card p-5 overflow-hidden",
      "shadow-[var(--shadow-card)]",
      className,
    )}>
      {/* Subtle gradient accent in top-right */}
      <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-2/5 bg-gradient-to-br from-sky-100/40 to-transparent" />

      <div className="relative z-10">
        {/* Top row: label + icon chip */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground leading-none">{label}</p>
          {Icon && (
            <div className={cn("icon-chip h-9 w-9 transition-transform duration-200 group-hover:scale-105", `icon-chip-${tint}`)}>
              <Icon className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mt-3">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <p
              className={cn("text-[30px] font-extrabold leading-none tracking-[-0.024em]", accentColor ?? "text-foreground")}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatValue(value, format)}
            </p>
          )}
        </div>

        {/* Delta */}
        {delta && !loading && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {DeltaIcon && (
              <span className={cn("inline-flex h-5 w-5 items-center justify-center rounded-full", deltaChip, deltaColor)}>
                <DeltaIcon className="h-3 w-3" />
              </span>
            )}
            <span className={cn("text-[11.5px] font-medium", deltaColor)}>
              {delta.value}{delta.label ? ` ${delta.label}` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
