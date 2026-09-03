import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Receipt, Target, TrendingUp, Users, Wallet } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  AnalyticsFilters,
  defaultAnalyticsFilters,
  type AnalyticsFiltersValue,
} from "@/components/analytics/AnalyticsFilters";
import {
  CHART_TOOLTIP_CURSOR,
  CHART_TOOLTIP_STYLE,
  FunnelBars,
  InsightStack,
  Panel,
  RankedBarChart,
  renderChartLegend,
  StatusChips,
  StoryBanner,
} from "@/components/analytics/InsightPanel";
import { EmptyState } from "@/components/EmptyState";
import { MetaAdsPage } from "@/components/meta/MetaAdsPage";
import { KpiCard } from "@/components/ui/kpi-card";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import {
  buildFunnelInsights,
  buildHeadline,
  buildRankingInsights,
  countByStatus,
  fmtMoneyCompact,
  funnelStages,
  insightFromGap,
} from "@/lib/analytics-insights";
import { calcCaq } from "@/lib/analytics-range";
import { supabase } from "@/integrations/supabase/client";

const ROI_TABS = ["operacao", "clientes", "marketing"] as const;

type TabId = (typeof ROI_TABS)[number];

function resolveRoiTab(raw: unknown): TabId {
  // Legado: oportunidades foi unificado em clientes.
  if (raw === "oportunidades") return "clientes";
  // Legado: campanhas foi unificado em Marketing pago (mesma tabela metricas_ads).
  if (raw === "campanhas") return "marketing";
  return ROI_TABS.includes(raw as TabId) ? (raw as TabId) : "operacao";
}

export const Route = createFileRoute("/_authenticated/admin/roi")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: resolveRoiTab(search.tab),
  }),
  component: RoiAdminPage,
  head: () => ({ meta: [{ title: "ROI da operação — Tabgha Admin" }] }),
});

type Metrica = {
  id: string;
  cliente_id: string;
  data: string;
  plataforma: string;
  campanha: string | null;
  ad_id?: string | null;
  anuncio?: string | null;
  nivel?: string | null;
  investimento: number;
  leads: number;
  conversoes: number;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
  clientes: { nome: string; especialidade: string | null } | null;
};

function isCampaignMetrica(m: Metrica) {
  return !(m.ad_id ?? "").trim();
}

type LeadRow = {
  id: string;
  cliente_id: string;
  status: string;
  canal: string | null;
  criado_em: string;
  clientes: { nome: string; especialidade: string | null } | null;
};

function fmt(v: number) {
  if (v >= 1000) return `R$ ${(v / 1000).toFixed(1)}k`;
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 0 })}`;
}

function RoiAdminPage() {
  const { tab } = Route.useSearch();
  const [filters, setFilters] = useState<AnalyticsFiltersValue>(defaultAnalyticsFilters("30d"));
  const [showAllRows, setShowAllRows] = useState(false);
  const { data: clientesOptions = [] } = useClientesOptions();

  const { data: clientesFull = [] } = useQuery({
    queryKey: ["admin", "roi", "clientes-cat"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, especialidade")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const categorias = useMemo(
    () => [...new Set(clientesFull.map((c) => c.especialidade).filter(Boolean) as string[])].sort(),
    [clientesFull],
  );

  const clienteIdsByCategoria = useMemo(() => {
    if (!filters.categoria) return null;
    return new Set(
      clientesFull.filter((c) => c.especialidade === filters.categoria).map((c) => c.id),
    );
  }, [clientesFull, filters.categoria]);

  const { data: metricas = [], isLoading } = useQuery<Metrica[]>({
    queryKey: ["admin", "roi", "metricas", filters],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("metricas_ads")
        .select("*, clientes(nome, especialidade)")
        .gte("data", filters.range.since)
        .lte("data", filters.range.until)
        .order("data", { ascending: false });
      if (filters.clienteId) q = q.eq("cliente_id", filters.clienteId);
      if (filters.plataforma) q = q.eq("plataforma", filters.plataforma);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Metrica[];
    },
  });

  const { data: leads = [] } = useQuery<LeadRow[]>({
    queryKey: ["admin", "roi", "leads", filters],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("leads")
        .select("id, cliente_id, status, canal, criado_em, clientes(nome, especialidade)")
        .gte("criado_em", `${filters.range.since}T00:00:00.000Z`)
        .lte("criado_em", `${filters.range.until}T23:59:59.999Z`)
        .order("criado_em", { ascending: false });
      if (filters.clienteId) q = q.eq("cliente_id", filters.clienteId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LeadRow[];
    },
  });

  const metricasFiltradas = useMemo(() => {
    const scoped = clienteIdsByCategoria
      ? metricas.filter((m) => clienteIdsByCategoria.has(m.cliente_id))
      : metricas;
    // KPIs e rankings usam só nível campanha — evita somar campanha + anúncio.
    return scoped.filter(isCampaignMetrica);
  }, [metricas, clienteIdsByCategoria]);

  const leadsFiltrados = useMemo(() => {
    if (!clienteIdsByCategoria) return leads;
    return leads.filter((l) => clienteIdsByCategoria.has(l.cliente_id));
  }, [leads, clienteIdsByCategoria]);

  const kpis = useMemo(() => {
    const totalInvest = metricasFiltradas.reduce((s, m) => s + Number(m.investimento), 0);
    const totalLeadsAds = metricasFiltradas.reduce((s, m) => s + m.leads, 0);
    const leadsCrm = leadsFiltrados.length;
    const leadsBase = leadsCrm > 0 ? leadsCrm : totalLeadsAds;
    const qualificados = leadsFiltrados.filter((l) => l.status !== "novo").length;
    const convertidos = leadsFiltrados.filter((l) => l.status === "convertido").length;
    const caq = calcCaq(totalInvest, leadsBase);
    const cplArr = metricasFiltradas.filter((m) => m.cpl != null).map((m) => Number(m.cpl));
    const cplMed = cplArr.length ? cplArr.reduce((a, b) => a + b, 0) / cplArr.length : null;
    return {
      totalInvest,
      totalLeadsAds,
      leadsCrm,
      leadsBase,
      qualificados,
      convertidos,
      caq,
      cplMed,
    };
  }, [metricasFiltradas, leadsFiltrados]);

  const byCliente = useMemo(() => {
    const map = new Map<
      string,
      { id: string; nome: string; investimento: number; leads: number; conversoes: number }
    >();
    for (const m of metricasFiltradas) {
      const nome = m.clientes?.nome ?? m.cliente_id.slice(0, 8);
      const prev = map.get(m.cliente_id) ?? {
        id: m.cliente_id,
        nome,
        investimento: 0,
        leads: 0,
        conversoes: 0,
      };
      map.set(m.cliente_id, {
        ...prev,
        investimento: prev.investimento + Number(m.investimento),
        leads: prev.leads + m.leads,
        conversoes: prev.conversoes + m.conversoes,
      });
    }
    return Array.from(map.values())
      .map((row) => ({ ...row, caq: calcCaq(row.investimento, row.leads) }))
      .sort((a, b) => b.investimento - a.investimento);
  }, [metricasFiltradas]);

  const oportunidades = useMemo(() => {
    const map = new Map<
      string,
      { nome: string; novos: number; qualificacao: number; convertidos: number; total: number }
    >();
    for (const l of leadsFiltrados) {
      const nome = l.clientes?.nome ?? "Cliente";
      const prev = map.get(l.cliente_id) ?? {
        nome,
        novos: 0,
        qualificacao: 0,
        convertidos: 0,
        total: 0,
      };
      prev.total += 1;
      if (l.status === "novo") prev.novos += 1;
      else if (l.status === "convertido") prev.convertidos += 1;
      else prev.qualificacao += 1;
      map.set(l.cliente_id, prev);
    }
    return Array.from(map.entries())
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => b.total - a.total);
  }, [leadsFiltrados]);

  const rowsVisible = showAllRows ? metricasFiltradas : metricasFiltradas.slice(0, 5);

  const headline = buildHeadline({
    invest: kpis.totalInvest,
    leadsCrm: kpis.leadsCrm,
    leadsAds: kpis.totalLeadsAds,
    caq: kpis.caq,
    convertidos: kpis.convertidos,
    perdidos: leadsFiltrados.filter((l) => l.status === "perdido").length,
  });
  const funnel = funnelStages(leadsFiltrados);
  const statusBreakdown = countByStatus(leadsFiltrados);
  const funnelInsights = buildFunnelInsights(leadsFiltrados);
  const rankingInsights = buildRankingInsights(
    byCliente.map((r) => ({
      nome: r.nome,
      investimento: r.investimento,
      leads: r.leads,
      caq: r.caq,
    })),
  );
  const adsCrmGap = insightFromGap(kpis.totalLeadsAds, kpis.leadsCrm);

  const pageTitle: Record<TabId, string> = {
    operacao: "Operação",
    clientes: "Clientes",
    marketing: "Marketing pago",
  };
  const pageDescription: Record<TabId, string> = {
    operacao: "Investimento, leads e CAQ consolidados de toda a operação.",
    clientes: "ROI por clínica: investimento, leads e conversão comparados.",
    campanhas: "Ranking de campanhas por investimento, leads e custo por lead.",
    marketing: "Métricas detalhadas de anúncios (Meta Ads) por cliente.",
  };

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow-pill">ROI da operação</span>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">{pageTitle[tab]}</h1>
        </div>
        {tab !== "marketing" ? (
          <AnalyticsFilters
            value={filters}
            onChange={(next) => {
              setShowAllRows(false);
              setFilters(next);
            }}
            clientes={clientesOptions}
            categorias={categorias}
          />
        ) : null}
      </div>
      {tab !== "marketing" ? (
        <AnalyticsFilters
          value={filters}
          onChange={(next) => {
            setShowAllRows(false);
            setFilters(next);
          }}
          clientes={clientesOptions}
          categorias={categorias}
        />
      ) : null}

      {tab === "marketing" ? (
        <MetaAdsPage isAdmin embedded defaultTab="anuncios" />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : metricasFiltradas.length === 0 && leadsFiltrados.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="Nenhuma métrica no filtro"
          description="Ajuste período, cliente ou sincronize em Marketing pago."
        />
      ) : (
        <>
          {tab === "operacao" ? (
            <>
              <StoryBanner {...headline} />
              {adsCrmGap ? (
                <InsightStack items={[{ title: "Ads × funil", body: adsCrmGap, tone: "info" }]} />
              ) : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="animate-fade-up">
                  <KpiCard
                    label="CAQ"
                    value={kpis.caq != null ? fmt(kpis.caq) : "—"}
                    icon={Target}
                    tint="blue"
                    format="raw"
                    delta={{ value: "quanto custa cada lead", direction: "neutral" }}
                  />
                </div>
                <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
                  <KpiCard
                    label="Investido"
                    value={fmt(kpis.totalInvest)}
                    icon={Wallet}
                    tint="sky"
                    format="raw"
                  />
                </div>
                <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
                  <KpiCard
                    label="Leads"
                    value={String(kpis.leadsBase)}
                    icon={Users}
                    tint="violet"
                    format="raw"
                    delta={{
                      value:
                        kpis.leadsCrm > 0
                          ? `${kpis.leadsCrm} no CRM · ${kpis.totalLeadsAds} Ads`
                          : `${kpis.totalLeadsAds} via Ads`,
                      direction: "neutral",
                    }}
                  />
                </div>
                <div className="animate-fade-up" style={{ animationDelay: "180ms" }}>
                  <KpiCard
                    label="CPL médio"
                    value={kpis.cplMed != null ? fmt(kpis.cplMed) : "—"}
                    icon={Receipt}
                    tint="amber"
                    format="raw"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Funil da operação" subtitle="Onde as oportunidades param" tone="soft">
                  <FunnelBars stages={funnel} />
                </Panel>
                <Panel title="Status dos leads" subtitle="Distribuição atual">
                  <StatusChips items={statusBreakdown} />
                </Panel>
              </div>

              {byCliente.length > 0 ? (
                <div className="animate-fade-up rounded-2xl border border-border bg-gradient-to-br from-slate-50 to-sky-50/60 p-5 shadow-[var(--shadow-card)]">
                  <p className="mt-1 text-base font-bold text-foreground">
                    Investimento × Leads por cliente
                  </p>
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={byCliente.slice(0, 8)}
                        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,27,53,0.08)" />
                        <XAxis
                          dataKey="nome"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 11, fill: "#64748b" }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={CHART_TOOLTIP_STYLE}
                          cursor={CHART_TOOLTIP_CURSOR}
                          formatter={(v: number, name: string) =>
                            name === "Investimento" ? [fmt(v), name] : [v, name]
                          }
                        />
                        <Legend content={renderChartLegend} />
                        <Bar
                          yAxisId="left"
                          dataKey="investimento"
                          name="Investimento"
                          fill="#0ea5e9"
                          radius={[4, 4, 0, 0]}
                        />
                        <Bar
                          yAxisId="right"
                          dataKey="leads"
                          name="Leads"
                          fill="#0369a1"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Registros do período
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {Math.min(5, metricasFiltradas.length)} de {metricasFiltradas.length}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/40 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                        <th className="px-4 py-2.5 text-left">#</th>
                        <th className="px-4 py-2.5 text-left">Cliente</th>
                        <th className="px-4 py-2.5 text-left">Data</th>
                        <th className="px-4 py-2.5 text-left">Plataforma</th>
                        <th className="px-4 py-2.5 text-right">Investimento</th>
                        <th className="px-4 py-2.5 text-right">Leads</th>
                        <th className="px-4 py-2.5 text-right">CAQ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {rowsVisible.map((m, idx) => {
                        const caq = calcCaq(Number(m.investimento), m.leads);
                        return (
                          <tr key={m.id} className="transition-colors hover:bg-secondary/40">
                            <td className="px-4 py-2.5 text-[10px] font-black tabular-nums text-muted-foreground/30">
                              {String(idx + 1).padStart(2, "0")}
                            </td>
                            <td className="px-4 py-2.5 font-medium">{m.clientes?.nome ?? "—"}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{m.data}</td>
                            <td className="px-4 py-2.5">
                              <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-800">
                                {m.plataforma}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {fmt(Number(m.investimento))}
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">{m.leads}</td>
                            <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                              {caq != null ? fmt(caq) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {metricasFiltradas.length > 5 ? (
                  <div className="border-t border-border px-5 py-3">
                    <button
                      type="button"
                      onClick={() => setShowAllRows((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
                    >
                      {showAllRows
                        ? "Mostrar só os 5 primeiros"
                        : "Saber mais — ver todos os registros"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {tab === "clientes" ? (
            <div className="space-y-4">
              <StoryBanner
                title={`${kpis.leadsCrm} oportunidades · ${byCliente.length} clínicas no filtro`}
                body={`${kpis.qualificados} já saíram do “novo” e ${kpis.convertidos} viraram paciente. Abaixo: mídia por clínica e onde o funil trava.`}
                tone={kpis.convertidos > 0 ? "good" : "info"}
              />
              <InsightStack items={[...rankingInsights, ...funnelInsights].slice(0, 3)} />

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Investimento por clínica" tone="soft">
                  <RankedBarChart
                    data={byCliente.slice(0, 8).map((r) => ({
                      name: r.nome.length > 18 ? `${r.nome.slice(0, 16)}…` : r.nome,
                      value: Math.round(r.investimento),
                    }))}
                    formatValue={(v) => fmtMoneyCompact(v)}
                  />
                </Panel>
                <Panel title="Leads gerados por clínica" tone="soft">
                  <RankedBarChart
                    data={[...byCliente]
                      .sort((a, b) => b.leads - a.leads)
                      .slice(0, 8)
                      .map((r) => ({
                        name: r.nome.length > 18 ? `${r.nome.slice(0, 16)}…` : r.nome,
                        value: r.leads,
                      }))}
                    color="#0ea5e9"
                  />
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Funil" tone="soft">
                  <FunnelBars stages={funnel} />
                </Panel>
                <Panel title="Status">
                  <StatusChips items={statusBreakdown} />
                </Panel>
              </div>

              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/40 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                      <th className="px-4 py-2.5 text-left">Cliente</th>
                      <th className="px-3 py-2.5 text-right">Invest.</th>
                      <th className="px-3 py-2.5 text-right">Leads Ads</th>
                      <th className="px-3 py-2.5 text-right">Novos</th>
                      <th className="px-3 py-2.5 text-right">Qualif.</th>
                      <th className="px-3 py-2.5 text-right">Conv.</th>
                      <th className="px-3 py-2.5 text-right">CAQ</th>
                      <th className="px-3 py-2.5 text-right" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {(() => {
                      const oppById = new Map(oportunidades.map((o) => [o.id, o]));
                      const ids = new Set([
                        ...byCliente.map((r) => r.id),
                        ...oportunidades.map((o) => o.id),
                      ]);
                      const rows = [...ids].map((id) => {
                        const media = byCliente.find((r) => r.id === id);
                        const opp = oppById.get(id);
                        return {
                          id,
                          nome: media?.nome ?? opp?.nome ?? "Cliente",
                          investimento: media?.investimento ?? 0,
                          leadsAds: media?.leads ?? 0,
                          novos: opp?.novos ?? 0,
                          qualificacao: opp?.qualificacao ?? 0,
                          convertidos: opp?.convertidos ?? 0,
                          caq: media?.caq ?? null,
                        };
                      });
                      rows.sort(
                        (a, b) =>
                          b.investimento - a.investimento ||
                          b.novos +
                            b.qualificacao +
                            b.convertidos -
                            (a.novos + a.qualificacao + a.convertidos),
                      );
                      if (rows.length === 0) {
                        return (
                          <tr>
                            <td
                              colSpan={8}
                              className="px-4 py-10 text-center text-sm text-muted-foreground"
                            >
                              Sem clínicas nem leads neste filtro.
                            </td>
                          </tr>
                        );
                      }
                      return rows.map((row) => (
                        <tr key={row.id} className="transition-colors hover:bg-secondary/40">
                          <td className="px-4 py-3 font-medium">{row.nome}</td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {row.investimento > 0 ? fmt(row.investimento) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">{row.leadsAds}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{row.novos}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{row.qualificacao}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{row.convertidos}</td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {row.caq != null ? fmt(row.caq) : "—"}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <Link
                              to={"/admin/clientes/$id" as never}
                              params={{ id: row.id } as never}
                              className="text-xs font-semibold text-sky-700 hover:underline"
                            >
                              Abrir
                            </Link>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              <Link
                to="/admin/leads"
                search={{
                  periodo: 30,
                  canal: "",
                  cliente: filters.clienteId ?? "",
                  q: "",
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
              >
                Abrir funil completo <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
