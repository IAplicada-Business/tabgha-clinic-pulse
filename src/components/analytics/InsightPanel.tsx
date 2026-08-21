import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtMoneyCompact, fmtPct, type PlainInsight } from "@/lib/analytics-insights";

export function Panel({
  title,
  subtitle,
  action,
  children,
  className,
  tone = "card",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  tone?: "card" | "soft";
}) {
  return (
    <section
      className={cn(
        "card-lift overflow-hidden rounded-2xl border border-border/70 shadow-[var(--shadow-card)]",
        tone === "soft" ? "bg-gradient-to-br from-slate-50 via-white to-sky-50/70" : "bg-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          {subtitle ? <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StoryBanner({
  title,
  body,
  tone = "info",
}: {
  title: string;
  body: string;
  tone?: "info" | "good" | "warn";
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border px-5 py-5 shadow-[var(--shadow-card)] sm:px-7 sm:py-6",
        tone === "info" &&
          "border-sky-200/70 bg-gradient-to-br from-sky-50 via-white to-blue-50/60 text-sky-950",
        tone === "good" &&
          "border-emerald-200/70 bg-gradient-to-br from-emerald-50 via-white to-slate-50 text-emerald-950",
        tone === "warn" &&
          "border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50/50 text-amber-950",
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/50 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 right-16 h-28 w-28 rounded-full bg-brand-blue/5 blur-2xl" />
      <div className="relative flex items-start gap-4">
        <span
          className={cn(
            "icon-chip mt-0.5 h-11 w-11 shrink-0",
            tone === "info" && "icon-chip-blue",
            tone === "good" && "icon-chip-green",
            tone === "warn" && "icon-chip-amber",
          )}
        >
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] opacity-60">
            O que está acontecendo
          </p>
          <h2 className="mt-1 text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-foreground/80">{body}</p>
        </div>
      </div>
    </div>
  );
}

export function InsightCallout({
  title,
  body,
  tone = "info",
}: {
  title: string;
  body: string;
  tone?: "info" | "good" | "warn";
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3 text-sm",
        tone === "info" && "border-sky-200 bg-sky-50/80 text-sky-950",
        tone === "good" && "border-emerald-200 bg-emerald-50/80 text-emerald-950",
        tone === "warn" && "border-amber-200 bg-amber-50/80 text-amber-950",
      )}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed">{body}</p>
    </div>
  );
}

export function InsightStack({ items }: { items: PlainInsight[] }) {
  if (items.length === 0) return null;
  // 1 insight = largura total (evita card “cortado”); 2+ ficam lado a lado.
  const cols =
    items.length === 1
      ? "grid-cols-1"
      : items.length === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
  return (
    <div className={cn("grid gap-3", cols)}>
      {items.map((item) => (
        <InsightCallout key={item.title + item.body.slice(0, 24)} {...item} />
      ))}
    </div>
  );
}

export function KpiStrip({
  items,
}: {
  items: Array<{
    rank: string;
    label: string;
    value: string;
    hint?: string;
    tone?: "default" | "good" | "warn" | "bad";
  }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.rank + item.label}
          className="card-lift animate-fade-up flex flex-col rounded-2xl border border-border bg-card px-5 pb-4 pt-5 shadow-[var(--shadow-card)]"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <span className="mb-3 text-[9px] font-black tracking-[0.16em] text-muted-foreground/40">
            {item.rank}
          </span>
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {item.label}
          </p>
          <p
            className={cn(
              "mt-2 text-[1.9rem] font-black leading-none tracking-tight",
              item.tone === "good" && "text-emerald-700",
              item.tone === "warn" && "text-amber-700",
              item.tone === "bad" && "text-rose-600",
              (!item.tone || item.tone === "default") && "text-sky-900",
            )}
          >
            {item.value}
          </p>
          {item.hint ? <p className="mt-2 text-[11px] text-muted-foreground">{item.hint}</p> : null}
          <div
            className={cn(
              "mt-3 h-0.5 w-full rounded-full",
              item.tone === "good" && "bg-emerald-500",
              item.tone === "warn" && "bg-amber-400",
              item.tone === "bad" && "bg-rose-400",
              (!item.tone || item.tone === "default") && "bg-sky-500",
            )}
          />
        </div>
      ))}
    </div>
  );
}

export function FunnelBars({
  stages,
}: {
  stages: Array<{
    label: string;
    count: number;
    shareOfTotal: number | null;
    rateFromPrev: number | null;
    color: string;
  }>;
}) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  return (
    <div className="space-y-3">
      {stages.map((stage) => (
        <div key={stage.label}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-foreground">{stage.label}</span>
            <span className="tabular-nums text-muted-foreground">
              <strong className="text-foreground">{stage.count}</strong>
              {stage.shareOfTotal != null ? ` · ${fmtPct(stage.shareOfTotal)} do total` : ""}
              {stage.rateFromPrev != null && stage.label !== "Entrada"
                ? ` · ${fmtPct(stage.rateFromPrev)} vs etapa ant.`
                : ""}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.max(4, (stage.count / max) * 100)}%`,
                background: stage.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatusChips({
  items,
}: {
  items: Array<{ label: string; count: number; color: string }>;
}) {
  const total = items.reduce((s, i) => s + i.count, 0) || 1;
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-secondary">
        {items
          .filter((i) => i.count > 0)
          .map((item) => (
            <div
              key={item.label}
              title={`${item.label}: ${item.count}`}
              style={{
                width: `${(item.count / total) * 100}%`,
                background: item.color,
              }}
            />
          ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-border/70 bg-secondary/30 px-3 py-2.5 transition-colors hover:bg-secondary/50"
          >
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
              <span className="truncate text-[11px] text-muted-foreground">{item.label}</span>
            </div>
            <p className="mt-1 text-lg font-black tabular-nums text-foreground">{item.count}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  fontSize: 12,
};

/** Ranking horizontal com Recharts — fácil de ler para leigos */
export function RankedBarChart({
  data,
  valueKey = "value",
  nameKey = "name",
  color = "#0369a1",
  formatValue,
  height,
}: {
  data: Array<Record<string, string | number>>;
  valueKey?: string;
  nameKey?: string;
  color?: string | string[];
  formatValue?: (v: number) => string;
  height?: number;
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Sem dados para o gráfico
      </div>
    );
  }
  const h = height ?? Math.max(220, data.length * 36);
  const colors = Array.isArray(color) ? color : null;

  return (
    <div style={{ height: h }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,27,53,0.06)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#64748b" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => (formatValue ? formatValue(Number(v)) : String(v))}
          />
          <YAxis
            type="category"
            dataKey={nameKey}
            width={110}
            tick={{ fontSize: 11, fill: "#334155" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => [formatValue ? formatValue(value) : value, "Valor"]}
          />
          <Bar dataKey={valueKey} radius={[0, 6, 6, 0]} barSize={18}>
            {data.map((_, index) => (
              <Cell key={index} fill={colors ? colors[index % colors.length] : (color as string)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CorrelationStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/20 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-black tabular-nums text-sky-900">{value}</p>
      {detail ? <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

export function moneyOrDash(v: number | null | undefined) {
  if (v == null) return "—";
  return fmtMoneyCompact(v);
}
