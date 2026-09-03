import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Zap, Loader2, Users, UserPlus, CheckCircle2, Percent } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/ui/kpi-card";
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_CURSOR } from "@/components/analytics/InsightPanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/automacoes-leads")({
  component: AutomacoesLeadsPage,
  head: () => ({ meta: [{ title: "Automações de leads — Tabgha Admin" }] }),
});

type Lead = { id: string; status: string; canal: string | null; criado_em: string };
type ClienteMetrics = {
  id: string;
  nome: string;
  especialidade: string | null;
  status: string;
  leads: Lead[];
  leads_total: number;
  leads_novos: number;
  leads_em_andamento: number;
  leads_convertidos: number;
  taxa_conversao: number;
};

const LEAD_STATUSES = [
  "novo",
  "em_conversa",
  "interessado",
  "agendado",
  "atendido",
  "convertido",
  "perdido",
] as const;
const STATUS_LABEL: Record<string, string> = {
  novo: "Novo",
  em_conversa: "Em conversa",
  interessado: "Interessado",
  agendado: "Agendado",
  atendido: "Atendido",
  convertido: "Convertido",
  perdido: "Perdido",
};
const STATUS_COLOR: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700",
  em_conversa: "bg-amber-100 text-amber-700",
  interessado: "bg-violet-100 text-violet-700",
  agendado: "bg-cyan-100 text-cyan-700",
  atendido: "bg-teal-100 text-teal-700",
  convertido: "bg-green-100 text-green-700",
  perdido: "bg-slate-100 text-slate-600",
};
const STATUS_BAR: Record<string, string> = {
  novo: "bg-blue-400",
  em_conversa: "bg-amber-400",
  interessado: "bg-violet-400",
  agendado: "bg-cyan-400",
  atendido: "bg-teal-400",
  convertido: "bg-green-500",
  perdido: "bg-slate-300",
};

const TABGHA_ID = "00000000-0000-0000-0000-000000000001";

const CANAIS = ["WhatsApp", "Meta Ads", "Indicação", "Orgânico", "site", "Outro"];

const TABS = ["Pipeline", "Evolução"] as const;
type Tab = (typeof TABS)[number];

function AutomacoesLeadsPage() {
  const [tab, setTab] = useState<Tab>("Pipeline");
  const [filterCanal, setFilterCanal] = useState("");

  const startOfMonth = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const { data: metricas = [], isLoading } = useQuery<ClienteMetrics[]>({
    queryKey: ["admin", "automacoes-leads"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: clientes, error } = await supabase
        .from("clientes")
        .select("id, nome, especialidade, status, leads(id, status, canal, criado_em)")
        .in("status", ["ativo", "onboarding"])
        .order("nome");
      if (error) throw error;

      return (clientes ?? []).map((c): ClienteMetrics => {
        const leads = (Array.isArray(c.leads) ? c.leads : []) as Lead[];
        const total = leads.length;
        const novos = leads.filter((l) => l.criado_em >= startOfMonth.toISOString()).length;
        const emAndamento = leads.filter((l) =>
          ["em_conversa", "interessado", "agendado", "atendido", "convertido"].includes(l.status),
        ).length;
        const convertidos = leads.filter((l) => l.status === "convertido").length;
        const taxa = total > 0 ? (convertidos / total) * 100 : 0;
        return {
          id: c.id,
          nome: c.nome,
          especialidade: c.especialidade,
          status: c.status,
          leads,
          leads_total: total,
          leads_novos: novos,
          leads_em_andamento: emAndamento,
          leads_convertidos: convertidos,
          taxa_conversao: taxa,
        };
      });
    },
  });

  // Agregados globais
  const totais = useMemo(() => {
    const total = metricas.reduce((s, m) => s + m.leads_total, 0);
    const novos = metricas.reduce((s, m) => s + m.leads_novos, 0);
    const conv = metricas.reduce((s, m) => s + m.leads_convertidos, 0);
    const taxa = total > 0 ? ((conv / total) * 100).toFixed(0) : "—";
    return { total, novos, conv, taxa };
  }, [metricas]);

  // Funil global de status
  const funil = useMemo(() => {
    const map: Record<string, number> = {};
    for (const m of metricas) {
      for (const l of m.leads) {
        if (filterCanal && l.canal !== filterCanal) continue;
        map[l.status] = (map[l.status] ?? 0) + 1;
      }
    }
    return LEAD_STATUSES.map((s) => ({ status: s, label: STATUS_LABEL[s], count: map[s] ?? 0 }));
  }, [metricas, filterCanal]);

  const maxFunil = Math.max(...funil.map((f) => f.count), 1);

  // Evolução: leads por dia (últimos 30d)
  const evolucao = useMemo(() => {
    const days: Record<string, number> = {};
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 29);
    for (const m of metricas) {
      for (const l of m.leads) {
        if (filterCanal && l.canal !== filterCanal) continue;
        const d = l.criado_em.slice(0, 10);
        if (d >= cutoff.toISOString().slice(0, 10)) days[d] = (days[d] ?? 0) + 1;
      }
    }
    return Object.entries(days)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({
        date: date.slice(5),
        count,
      }));
  }, [metricas, filterCanal]);

  const kpis = [
    { label: "Leads totais", value: String(totais.total), icon: Users, tint: "blue" as const },
    { label: "Novos (mês)", value: String(totais.novos), icon: UserPlus, tint: "sky" as const },
    { label: "Convertidos", value: String(totais.conv), icon: CheckCircle2, tint: "green" as const },
    { label: "% Conversão", value: `${totais.taxa}%`, icon: Percent, tint: "green" as const },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fade-up">
        <div>
          <span className="eyebrow-pill">Leads / CRM</span>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Automações de leads</h1>
          <p className="text-xs text-muted-foreground mt-0.5">CPL · CPA · jornada de captação por cliente</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filterCanal}
            onChange={(e) => setFilterCanal(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            <option value="">Todos canais</option>
            {CANAIS.map((c) => (
              <option key={c} value={c}>{c === "site" ? "Leads do site (Tabgha)" : c}</option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : metricas.length === 0 ? (
        <EmptyState icon={<Zap className="h-6 w-6" />} title="Nenhum cliente ativo" />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {kpis.map((k, i) => (
              <div key={k.label} className="animate-fade-up" style={{ animationDelay: i * 75 + "ms" }}>
                <KpiCard label={k.label} value={k.value} icon={k.icon} tint={k.tint} format="raw" />
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="segmented animate-fade-up" style={{ animationDelay: "300ms" }}>
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                data-active={tab === t ? "true" : undefined}
                className="segmented-item"
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "Pipeline" && (
            <div className="space-y-6">
              {/* Funil visual */}
              <div
                className="rounded-2xl border border-border bg-gradient-to-br from-slate-50 to-sky-50/60 shadow-[0_1px_3px_rgba(15,27,53,0.04)] animate-fade-up"
                style={{ animationDelay: "375ms" }}
              >
                <div className="p-5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    Funil global de leads
                  </p>
                  <div className="flex flex-col gap-3">
                    {funil.map((f) => (
                      <div key={f.status} className="flex items-center gap-3">
                        <span className="w-28 text-[11px] text-muted-foreground text-right shrink-0">
                          {f.label}
                        </span>
                        <div className="flex-1 h-6 rounded-md bg-secondary/60 overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-md transition-all",
                              STATUS_BAR[f.status] ?? "bg-muted-foreground/20",
                            )}
                            style={{
                              width: `${(f.count / maxFunil) * 100}%`,
                              minWidth: f.count > 0 ? 32 : 0,
                            }}
                          />
                        </div>
                        <span className="w-8 text-[11px] font-bold text-foreground text-right shrink-0 tabular-nums">
                          {f.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabela por cliente */}
              <div
                className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] animate-fade-up"
                style={{ animationDelay: "450ms" }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
                  Por cliente
                </p>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-secondary/40 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                          <th className="px-4 py-2.5 text-left w-8">#</th>
                          {["Cliente", "Especialidade", "Total", "Novos/mês", "Em andamento", "Convertidos", "% Conv."].map((h) => (
                            <th key={h} className="px-4 py-2.5 text-left">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {metricas.map((m, i) => (
                          <tr key={m.id} className="hover:bg-secondary/40 transition-colors">
                            <td className="px-4 py-3 text-[10px] font-black text-muted-foreground/30 tabular-nums">
                              {String(i + 1).padStart(2, "0")}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              <span className="flex items-center gap-2">
                                {m.nome}
                                {m.id === TABGHA_ID && (
                                  <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-semibold text-cyan-700">
                                    site
                                  </span>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">
                              {m.especialidade ?? "—"}
                            </td>
                            <td className="px-4 py-3 tabular-nums">{m.leads_total}</td>
                            <td className="px-4 py-3 font-semibold text-primary tabular-nums">
                              {m.leads_novos}
                            </td>
                            <td className="px-4 py-3 tabular-nums">{m.leads_em_andamento}</td>
                            <td className="px-4 py-3 font-semibold text-emerald-700 tabular-nums">
                              {m.leads_convertidos}
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              {m.taxa_conversao > 0 ? (
                                <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-green-100 text-green-700">
                                  {m.taxa_conversao.toFixed(0)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "Evolução" && (
            <div
              className="rounded-2xl border border-border bg-gradient-to-br from-slate-50 to-sky-50/60 p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)] animate-fade-up"
              style={{ animationDelay: "375ms" }}
            >
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Leads por dia — últimos 30 dias
              </p>
              {evolucao.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Sem dados para o período
                </p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={evolucao} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,27,53,0.08)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} allowDecimals={false} />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_TOOLTIP_CURSOR} />
                      <Bar dataKey="count" name="Leads" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
