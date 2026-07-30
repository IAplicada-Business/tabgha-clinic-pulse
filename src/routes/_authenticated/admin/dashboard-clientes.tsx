import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
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
import { SubTabs } from "@/components/analytics/SubTabs";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { calcCaq } from "@/lib/analytics-range";
import {
  buildFunnelInsights,
  buildHeadline,
  buildRankingInsights,
  countByStatus,
  fmtMoneyCompact,
  funnelStages,
  insightFromGap,
} from "@/lib/analytics-insights";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/dashboard-clientes")({
  component: DashboardClientesPage,
  head: () => ({ meta: [{ title: "Dashboard Clientes — Admin" }] }),
});

type TabId = "visao" | "performance" | "oportunidades";

function fmtMoney(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function isCampaignMetrica(m: { ad_id?: string | null }) {
  return !(m.ad_id ?? "").trim();
}

function DashboardClientesPage() {
  const [tab, setTab] = useState<TabId>("visao");
  const [filters, setFilters] = useState<AnalyticsFiltersValue>(defaultAnalyticsFilters("30d"));
  const { data: clientesOptions = [] } = useClientesOptions();

  const { data: clientesFull = [] } = useQuery({
    queryKey: ["admin", "dashboard-clientes", "clientes-cat"],
    staleTime: 120_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, especialidade, status")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const categorias = useMemo(
    () => [...new Set(clientesFull.map((c) => c.especialidade).filter(Boolean) as string[])].sort(),
    [clientesFull],
  );

  const { data, isLoading } = useQuery({
    queryKey: [
      "admin",
      "dashboard-clientes",
      filters,
      clientesFull.map((c) => `${c.id}:${c.status}`).join("|"),
    ],
    staleTime: 60_000,
    queryFn: async () => {
      const { since, until } = filters.range;
      const sinceIso = `${since}T00:00:00.000Z`;
      const untilIso = `${until}T23:59:59.999Z`;

      let leadsQ = supabase
        .from("leads")
        .select("id, cliente_id, status, canal, criado_em, clientes(nome, especialidade, status)")
        .gte("criado_em", sinceIso)
        .lte("criado_em", untilIso);
      if (filters.clienteId) leadsQ = leadsQ.eq("cliente_id", filters.clienteId);

      let metricasQ = supabase
        .from("metricas_ads")
        .select(
          "cliente_id, data, investimento, leads, plataforma, campanha, ad_id, clientes(nome, especialidade)",
        )
        .gte("data", since)
        .lte("data", until);
      if (filters.clienteId) metricasQ = metricasQ.eq("cliente_id", filters.clienteId);
      if (filters.plataforma) metricasQ = metricasQ.eq("plataforma", filters.plataforma);

      const [leadsRes, metricasRes, carteiraRes] = await Promise.all([
        leadsQ,
        metricasQ,
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .in("status", ["ativo", "onboarding"]),
      ]);

      let leads = leadsRes.data ?? [];
      let metricas = (metricasRes.data ?? []).filter(isCampaignMetrica);

      if (filters.categoria) {
        leads = leads.filter(
          (l) =>
            (l.clientes as { especialidade?: string } | null)?.especialidade === filters.categoria,
        );
        metricas = metricas.filter(
          (m) =>
            (m.clientes as { especialidade?: string } | null)?.especialidade === filters.categoria,
        );
      }

      const dayMap: Record<string, number> = {};
      for (const l of leads) {
        const d = (l.criado_em as string).slice(0, 10);
        dayMap[d] = (dayMap[d] ?? 0) + 1;
      }
      const leadsTimeline = Object.entries(dayMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, count]) => ({ date: date.slice(5), count }));

      const investDayMap: Record<string, { investimento: number; leadsAds: number }> = {};
      for (const m of metricas) {
        const d = String(m.data).slice(0, 10);
        const prev = investDayMap[d] ?? { investimento: 0, leadsAds: 0 };
        prev.investimento += Number(m.investimento ?? 0);
        prev.leadsAds += Number(m.leads ?? 0);
        investDayMap[d] = prev;
      }
      const investTimeline = Object.entries(investDayMap)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, row]) => ({
          date: date.slice(5),
          investimento: Math.round(row.investimento),
          leadsAds: row.leadsAds,
        }));

      const invest = metricas.reduce((s, m) => s + Number(m.investimento ?? 0), 0);
      const leadsAds = metricas.reduce((s, m) => s + Number(m.leads ?? 0), 0);

      const perfMap = new Map<
        string,
        {
          nome: string;
          status: string;
          investimento: number;
          leadsAds: number;
          leadsCrm: number;
          leadsMeta: number;
        }
      >();

      for (const c of clientesFull) {
        if (filters.clienteId && c.id !== filters.clienteId) continue;
        if (filters.categoria && c.especialidade !== filters.categoria) continue;
        if (!["ativo", "onboarding", "pausa"].includes(c.status)) continue;
        perfMap.set(c.id, {
          nome: c.nome,
          status: c.status,
          investimento: 0,
          leadsAds: 0,
          leadsCrm: 0,
          leadsMeta: 0,
        });
      }

      for (const m of metricas) {
        const id = m.cliente_id as string;
        const nome =
          (m.clientes as { nome?: string } | null)?.nome ?? String(id).slice(0, 8);
        const prev = perfMap.get(id) ?? {
          nome,
          status: "ativo",
          investimento: 0,
          leadsAds: 0,
          leadsCrm: 0,
          leadsMeta: 0,
        };
        prev.investimento += Number(m.investimento ?? 0);
        prev.leadsAds += Number(m.leads ?? 0);
        perfMap.set(id, prev);
      }

      for (const l of leads) {
        const id = l.cliente_id as string;
        const nome =
          (l.clientes as { nome?: string } | null)?.nome ?? String(id).slice(0, 8);
        const prev = perfMap.get(id) ?? {
          nome,
          status: (l.clientes as { status?: string } | null)?.status ?? "ativo",
          investimento: 0,
          leadsAds: 0,
          leadsCrm: 0,
          leadsMeta: 0,
        };
        prev.leadsCrm += 1;
        if (["meta", "facebook"].includes(l.canal ?? "")) prev.leadsMeta += 1;
        perfMap.set(id, prev);
      }

      const performance = Array.from(perfMap.entries())
        .map(([id, row]) => ({
          id,
          ...row,
          gap: Math.max(0, row.leadsAds - row.leadsMeta),
          caq: calcCaq(row.investimento, row.leadsCrm > 0 ? row.leadsCrm : row.leadsAds),
        }))
        .sort((a, b) => b.investimento - a.investimento || b.leadsCrm - a.leadsCrm);

      const leadsMeta = leads.filter((l) => ["meta", "facebook"].includes(l.canal ?? "")).length;

      return {
        clientesAtivos: carteiraRes.count ?? 0,
        leadsPeriodo: leads.length,
        leadsMeta,
        invest,
        leadsAds,
        caq: calcCaq(invest, leads.length > 0 ? leads.length : leadsAds),
        leadsTimeline,
        investTimeline,
        performance,
        leadStatuses: leads.map((l) => ({
          status: l.status as string,
          canal: l.canal as string | null,
        })),
        perdidos: leads.filter((l) => l.status === "perdido").length,
        convertidos: leads.filter((l) => l.status === "convertido").length,
      };
    },
  });

  const headline = buildHeadline({
    invest: data?.invest ?? 0,
    leadsCrm: data?.leadsPeriodo ?? 0,
    leadsAds: data?.leadsAds ?? 0,
    caq: data?.caq ?? null,
    convertidos: data?.convertidos ?? 0,
    perdidos: data?.perdidos ?? 0,
  });
  const funnel = funnelStages(data?.leadStatuses ?? []);
  const statusBreakdown = countByStatus(data?.leadStatuses ?? []);
  const funnelInsights = buildFunnelInsights(data?.leadStatuses ?? []);
  const rankingInsights = buildRankingInsights(
    (data?.performance ?? []).map((r) => ({
      nome: r.nome,
      investimento: r.investimento,
      leads: r.leadsCrm > 0 ? r.leadsCrm : r.leadsAds,
      caq: r.caq,
    })),
  );
  const adsCrmGap = insightFromGap(data?.leadsAds ?? 0, data?.leadsMeta ?? 0);

  return (
    <div className="space-y-4 px-6 py-6">
      <header className="animate-fade-up flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard Clientes</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Performance por clínica: evolução de mídia, CAQ, funil e se a estratégia está
            respondendo
          </p>
        </div>
        <AnalyticsFilters
          value={filters}
          onChange={setFilters}
          clientes={clientesOptions}
          categorias={categorias}
          showPlataforma
        />
      </header>

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "visao", label: "Visão geral" },
          { id: "performance", label: "Performance por cliente" },
          { id: "oportunidades", label: "Oportunidades" },
        ]}
      />

      {tab === "visao" ? (
        <>
          {!isLoading ? <StoryBanner {...headline} /> : null}
          {adsCrmGap ? (
            <InsightStack
              items={[
                {
                  title: "Ads × funil Meta",
                  body: `${adsCrmGap} Use “Importar leads dos formulários” em Conectar Meta BM se o gap persistir.`,
                  tone: "info",
                },
              ]}
            />
          ) : null}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                rank: "01",
                label: "Clínicas ativas",
                value: data?.clientesAtivos ?? 0,
                accent: "text-primary",
                bar: "bg-primary",
              },
              {
                rank: "02",
                label: "Leads no período",
                value: data?.leadsPeriodo ?? 0,
                accent: "text-sky-700",
                bar: "bg-sky-500",
              },
              {
                rank: "03",
                label: "Investimento mídia",
                value: data ? fmtMoney(data.invest) : "—",
                accent: "text-foreground",
                bar: "bg-slate-400",
              },
              {
                rank: "04",
                label: "CAQ",
                value: data?.caq != null ? fmtMoney(data.caq) : "—",
                accent: "text-sky-800",
                bar: "bg-sky-600",
              },
            ].map((card, i) => (
              <div
                key={card.rank}
                className="card-lift animate-fade-up flex flex-col rounded-2xl border border-border bg-card px-5 pb-4 pt-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                <span className="mb-4 text-[9px] font-black tracking-[0.16em] text-muted-foreground/40">
                  {card.rank}
                </span>
                <p
                  className={cn(
                    "text-[2rem] font-black leading-none tracking-tighter",
                    card.accent,
                  )}
                >
                  {isLoading ? (
                    <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-secondary align-middle" />
                  ) : (
                    card.value
                  )}
                </p>
                <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {card.label}
                </p>
                <div className={cn("mt-4 h-0.5 w-full rounded-full", card.bar)} />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              title="Investimento × leads Ads"
              subtitle="Evolução diária da mídia e do volume reportado"
              tone="soft"
            >
              {isLoading ? (
                <div className="flex h-56 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (data?.investTimeline ?? []).length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Sem mídia no período — sincronize Marketing pago no ROI.
                </p>
              ) : (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data!.investTimeline}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(15,27,53,0.06)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fontSize: 9, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip contentStyle={CHART_TOOLTIP_STYLE} cursor={CHART_TOOLTIP_CURSOR} />
                      <Legend content={renderChartLegend} />
                      <Bar
                        yAxisId="left"
                        dataKey="investimento"
                        name="Invest. (R$)"
                        fill="#0369a1"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        yAxisId="right"
                        dataKey="leadsAds"
                        name="Leads Ads"
                        fill="#7dd3fc"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Panel>
            <Panel title="Funil em uma olhada" subtitle="Para explicar ao médico sem jargão">
              <FunnelBars stages={funnel} />
            </Panel>
          </div>

          <div className="animate-fade-up overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-50 via-white to-sky-50/70 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
            <div className="flex items-start justify-between px-6 pb-2 pt-5">
              <div>
                <p className="text-base font-bold text-foreground">Novos leads</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Evolução diária no período filtrado
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-black text-sky-800">{data?.leadsPeriodo ?? "—"}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">no filtro</p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (data?.leadsTimeline ?? []).length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2">
                <TrendingUp className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Sem dados no período</p>
              </div>
            ) : (
              <div className="h-48 px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={data!.leadsTimeline}
                    margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gradLeadsClientes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="#0284c7" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(15,27,53,0.06)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 9, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 9, fill: "#64748b" }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke="#0369a1"
                      strokeWidth={2.5}
                      fill="url(#gradLeadsClientes)"
                      dot={false}
                      activeDot={{ r: 4, fill: "#0369a1", stroke: "#fff", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </>
      ) : null}

      {tab === "performance" ? (
        <div className="space-y-4">
          <InsightStack items={rankingInsights} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              title="Investimento por clínica"
              subtitle="Quem está recebendo mais mídia"
              tone="soft"
            >
              <RankedBarChart
                data={(data?.performance ?? [])
                  .filter((r) => r.investimento > 0)
                  .slice(0, 8)
                  .map((r) => ({
                    name: r.nome.length > 18 ? `${r.nome.slice(0, 16)}…` : r.nome,
                    value: Math.round(r.investimento),
                  }))}
                formatValue={(v) => fmtMoneyCompact(v)}
              />
            </Panel>
            <Panel
              title="CAQ por clínica"
              subtitle="Quanto custa cada lead — menor é melhor"
              tone="soft"
            >
              <RankedBarChart
                data={(data?.performance ?? [])
                  .filter((r) => r.caq != null)
                  .sort((a, b) => (a.caq ?? 0) - (b.caq ?? 0))
                  .slice(0, 8)
                  .map((r) => ({
                    name: r.nome.length > 18 ? `${r.nome.slice(0, 16)}…` : r.nome,
                    value: Math.round(r.caq ?? 0),
                  }))}
                color={["#10b981", "#34d399", "#60a5fa", "#0369a1", "#f59e0b", "#f43f5e"]}
                formatValue={(v) => fmtMoneyCompact(v)}
              />
            </Panel>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <p className="text-sm font-bold">Por clínica</p>
              <Link
                to="/admin/roi"
                search={{ tab: "clientes" }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700 hover:underline"
              >
                Abrir ROI <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-secondary/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 text-left">Cliente</th>
                    <th className="px-3 py-2.5 text-right">Invest.</th>
                    <th className="px-3 py-2.5 text-right">Ads</th>
                    <th className="px-3 py-2.5 text-right">CRM</th>
                    <th className="px-3 py-2.5 text-right">Meta</th>
                    <th className="px-3 py-2.5 text-right">Gap</th>
                    <th className="px-3 py-2.5 text-right">CAQ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                      </td>
                    </tr>
                  ) : (data?.performance ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                        Sem clínicas no filtro.
                      </td>
                    </tr>
                  ) : (
                    data!.performance.map((row) => (
                      <tr key={row.id} className="hover:bg-secondary/30">
                        <td className="px-4 py-3">
                          <Link
                            to={"/admin/clientes/$id" as never}
                            params={{ id: row.id } as never}
                            className="font-medium hover:text-primary"
                          >
                            {row.nome}
                          </Link>
                          <p className="text-[10px] capitalize text-muted-foreground">
                            {row.status}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-[12px]">
                          {row.investimento > 0 ? fmtMoney(row.investimento) : "—"}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                          {row.leadsAds}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums">
                          {row.leadsCrm}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-sky-800">
                          {row.leadsMeta}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 text-right tabular-nums",
                            row.gap > 0 ? "font-semibold text-amber-700" : "text-muted-foreground",
                          )}
                        >
                          {row.gap}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {row.caq != null ? fmtMoney(row.caq) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "oportunidades" ? (
        <div className="space-y-4">
          <StoryBanner
            title={`${data?.leadsPeriodo ?? 0} oportunidades no funil`}
            body={`${data?.convertidos ?? 0} convertidas · ${data?.perdidos ?? 0} perdidas · ${data?.leadsMeta ?? 0} vieram da Meta.`}
            tone={(data?.convertidos ?? 0) > 0 ? "good" : "info"}
          />
          <InsightStack items={funnelInsights} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Funil CRM" subtitle="Todas as clínicas do filtro" tone="soft">
              <FunnelBars stages={funnel} />
            </Panel>
            <Panel title="Status dos leads" subtitle="Distribuição atual">
              <StatusChips items={statusBreakdown} />
            </Panel>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/leads"
              search={{ periodo: 30, canal: "", cliente: filters.clienteId ?? "", q: "" }}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-secondary"
            >
              Abrir funil <ArrowRight className="h-3 w-3" />
            </Link>
            <Link
              to="/admin/config-meta"
              className="rounded-lg border border-border px-3 py-1.5 text-[11px] font-semibold hover:bg-secondary"
            >
              Importar leads Meta
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
