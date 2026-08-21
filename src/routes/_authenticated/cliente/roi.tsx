import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  FunnelBars,
  InsightStack,
  Panel,
  RankedBarChart,
  StatusChips,
  StoryBanner,
} from "@/components/analytics/InsightPanel";
import { EmptyState } from "@/components/EmptyState";
import { MetaAdsPage } from "@/components/meta/MetaAdsPage";
import { useAuth } from "@/lib/auth";
import {
  buildCampaignInsights,
  buildFunnelInsights,
  buildHeadline,
  countByStatus,
  fmtMoneyCompact,
  funnelStages,
  insightFromGap,
} from "@/lib/analytics-insights";
import { calcCaq } from "@/lib/analytics-range";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

const ROI_TABS = ["operacao", "oportunidades", "campanhas", "marketing"] as const;
type TabId = (typeof ROI_TABS)[number];

export const Route = createFileRoute("/_authenticated/cliente/roi")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: ROI_TABS.includes(search.tab as TabId) ? (search.tab as TabId) : ("operacao" as TabId),
  }),
  component: RoiPage,
  head: () => ({ meta: [{ title: "ROI — Portal" }] }),
});

const PERIODOS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

type MetricaRow = {
  data: string;
  investimento: number | null;
  leads: number | null;
  conversoes: number | null;
  cpl: number | null;
  cpa: number | null;
  roas: number | null;
  plataforma: string;
  campanha: string | null;
  ad_id?: string | null;
};

function fmtCurrency(n: number) {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function isCampaignRow(m: MetricaRow) {
  return !(m.ad_id ?? "").trim();
}

function RoiPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [periodo, setPeriodo] = useState(30);

  function setTab(next: TabId) {
    void navigate({ search: (prev) => ({ ...prev, tab: next }) });
  }

  const { data, isLoading } = useQuery({
    queryKey: ["cliente", "roi", clienteId, periodo],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const from = subDays(new Date(), periodo).toISOString().slice(0, 10);
      const fromIso = `${from}T00:00:00.000Z`;

      const [{ data: metricas, error: mErr }, { data: leads, error: lErr }] = await Promise.all([
        supabase
          .from("metricas_ads")
          .select("data,investimento,leads,conversoes,cpl,cpa,roas,plataforma,campanha,ad_id")
          .eq("cliente_id", clienteId!)
          .gte("data", from)
          .order("data"),
        supabase
          .from("leads")
          .select("id,status,canal,criado_em")
          .eq("cliente_id", clienteId!)
          .gte("criado_em", fromIso),
      ]);
      if (mErr) throw mErr;
      if (lErr) throw lErr;
      return {
        metricas: ((metricas ?? []) as MetricaRow[]).filter(isCampaignRow),
        leads: leads ?? [],
      };
    },
  });

  const metricas = data?.metricas ?? [];
  const leads = data?.leads ?? [];

  const totais = metricas.reduce(
    (acc, m) => ({
      investimento: acc.investimento + Number(m.investimento ?? 0),
      leads: acc.leads + Number(m.leads ?? 0),
      conversoes: acc.conversoes + Number(m.conversoes ?? 0),
    }),
    { investimento: 0, leads: 0, conversoes: 0 },
  );
  const leadsCrm = leads.length;
  const leadsBase = leadsCrm > 0 ? leadsCrm : totais.leads;
  const cpl = leadsBase > 0 ? totais.investimento / leadsBase : null;
  const caq = calcCaq(totais.investimento, leadsBase);
  const convertidos = leads.filter((l) => l.status === "convertido").length;
  const perdidos = leads.filter((l) => l.status === "perdido").length;

  const chartData = Object.values(
    metricas.reduce<Record<string, { data: string; investimento: number; leads: number }>>(
      (acc, m) => {
        const key = m.data;
        if (!acc[key]) {
          acc[key] = {
            data: format(new Date(m.data), "dd/MM", { locale: ptBR }),
            investimento: 0,
            leads: 0,
          };
        }
        acc[key].investimento += Number(m.investimento ?? 0);
        acc[key].leads += Number(m.leads ?? 0);
        return acc;
      },
      {},
    ),
  );

  const byCampanha = useMemo(() => {
    const rows = data?.metricas ?? [];
    const map = new Map<string, { campanha: string; investimento: number; leads: number }>();
    for (const m of rows) {
      const key = m.campanha ?? "Sem campanha";
      const prev = map.get(key) ?? { campanha: key, investimento: 0, leads: 0 };
      prev.investimento += Number(m.investimento ?? 0);
      prev.leads += Number(m.leads ?? 0);
      map.set(key, prev);
    }
    return [...map.values()]
      .map((c) => ({ ...c, caq: calcCaq(c.investimento, c.leads) }))
      .sort((a, b) => b.investimento - a.investimento);
  }, [data?.metricas]);

  const headline = buildHeadline({
    invest: totais.investimento,
    leadsCrm,
    leadsAds: totais.leads,
    caq,
    convertidos,
    perdidos,
  });
  const funnel = funnelStages(leads);
  const statusBreakdown = countByStatus(leads);
  const funnelInsights = buildFunnelInsights(leads);
  const campaignInsights = buildCampaignInsights(byCampanha);
  const adsCrmGap = insightFromGap(totais.leads, leadsCrm);

  const kpis = [
    { rank: "01", label: "Investimento", value: fmtCurrency(totais.investimento) },
    { rank: "02", label: "Leads (funil)", value: String(leadsBase) },
    { rank: "03", label: "CPL médio", value: cpl != null ? fmtCurrency(cpl) : "—" },
    {
      rank: "04",
      label: "CAQ",
      value: caq != null ? fmtCurrency(caq) : "—",
      badge: { label: "investimento ÷ leads", color: "bg-sky-100 text-sky-800" },
    },
  ];

  const campaignSpendChart = byCampanha.slice(0, 8).map((c) => ({
    name: c.campanha.length > 22 ? `${c.campanha.slice(0, 20)}…` : c.campanha,
    value: c.investimento,
  }));
  const campaignLeadsChart = byCampanha.slice(0, 8).map((c) => ({
    name: c.campanha.length > 22 ? `${c.campanha.slice(0, 20)}…` : c.campanha,
    value: c.leads,
  }));

  const pageTitle: Record<TabId, string> = {
    operacao: "Operação",
    oportunidades: "Oportunidades",
    campanhas: "Campanhas",
    marketing: "Marketing pago",
  };

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="animate-fade-up flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            ROI
          </p>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight">{pageTitle[tab]}</h1>
        </div>
        {tab !== "marketing" ? (
          <div className="flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
            {PERIODOS.map((p) => (
              <button
                key={p.days}
                onClick={() => setPeriodo(p.days)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150",
                  periodo === p.days
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {tab === "marketing" ? (
        <MetaAdsPage fixedClienteId={clienteId ?? null} embedded defaultTab="anuncios" />
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : metricas.length === 0 && leads.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="h-6 w-6" />}
          title="Sem dados para o período"
          description="As métricas aparecem aqui conforme os dados forem sincronizados."
        />
      ) : (
        <>
          {tab === "operacao" ? (
            <>
              <StoryBanner {...headline} />
              {adsCrmGap ? (
                <InsightStack items={[{ title: "Ads × funil", body: adsCrmGap, tone: "info" }]} />
              ) : null}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {kpis.map(({ rank, label, value, badge }, i) => (
                  <div
                    key={label}
                    className="card-lift animate-fade-up flex flex-col rounded-2xl border border-border bg-card px-5 pb-4 pt-5 shadow-[var(--shadow-card)]"
                    style={{ animationDelay: `${i * 75}ms` }}
                  >
                    <span className="mb-4 text-[9px] font-black tracking-[0.16em] text-muted-foreground/40">
                      {rank}
                    </span>
                    <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="mt-auto animate-numeric-pop text-[2.4rem] font-black leading-none tracking-tight text-sky-800">
                      {value}
                    </p>
                    {badge ? (
                      <span
                        className={cn(
                          "mt-2 self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          badge.color,
                        )}
                      >
                        {badge.label}
                      </span>
                    ) : null}
                    <div className="mt-3 h-0.5 w-full rounded-full bg-sky-500" />
                  </div>
                ))}
              </div>

              <InsightStack items={[...campaignInsights, ...funnelInsights].slice(0, 3)} />

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Investimento × Leads" subtitle={`Últimos ${periodo} dias`} tone="soft">
                  {chartData.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Sem série diária de mídia no período
                    </p>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={chartData}
                          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="gradInvestRoi" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0284c7" stopOpacity={0.28} />
                              <stop offset="100%" stopColor="#0284c7" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradLeadsRoi" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.22} />
                              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(15,27,53,0.06)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="data"
                            tick={{ fontSize: 10, fill: "#64748b" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            yAxisId="left"
                            tick={{ fontSize: 10, fill: "#64748b" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <YAxis
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 10, fill: "#64748b" }}
                            tickLine={false}
                            axisLine={false}
                          />
                          <Tooltip
                            contentStyle={{
                              fontSize: 11,
                              borderRadius: 10,
                              background: "#fff",
                              border: "1px solid #e2e8f0",
                            }}
                            formatter={(v: number, name: string) => [
                              name === "Investimento (R$)" ? fmtCurrency(v) : v,
                              name,
                            ]}
                          />
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="investimento"
                            name="Investimento (R$)"
                            stroke="#0369a1"
                            strokeWidth={2.5}
                            fill="url(#gradInvestRoi)"
                            dot={false}
                          />
                          <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="leads"
                            name="Leads"
                            stroke="#0ea5e9"
                            strokeWidth={2}
                            fill="url(#gradLeadsRoi)"
                            dot={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </Panel>
                <Panel title="Funil da clínica" subtitle="Da entrada ao paciente">
                  <FunnelBars stages={funnel} />
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="Budget por campanha"
                  subtitle="Onde o investimento está concentrado"
                  tone="soft"
                >
                  {campaignSpendChart.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Sem campanhas no período
                    </p>
                  ) : (
                    <RankedBarChart
                      data={campaignSpendChart}
                      formatValue={(v) => fmtMoneyCompact(v)}
                      color={["#0369a1", "#0284c7", "#0ea5e9", "#38bdf8"]}
                    />
                  )}
                </Panel>
                <Panel title="Leads por campanha" subtitle="Quem está trazendo gente">
                  {campaignLeadsChart.length === 0 ? (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(15,27,53,0.06)" />
                          <XAxis
                            dataKey="data"
                            tick={{ fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="leads" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <RankedBarChart
                      data={campaignLeadsChart}
                      color={["#0f766e", "#14b8a6", "#2dd4bf", "#5eead4"]}
                    />
                  )}
                </Panel>
              </div>

              <Panel title="Status dos leads" subtitle="Onde cada oportunidade está agora">
                <StatusChips items={statusBreakdown} />
              </Panel>

              <Panel title="Registros do período" subtitle="Linhas de mídia (nível campanha)">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-secondary/60 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                        <th className="w-8 px-4 py-3 text-left font-semibold">#</th>
                        {["Data", "Plataforma", "Investimento", "Leads", "CAQ"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {metricas.slice(0, 5).map((m, idx) => {
                        const rowCaq =
                          Number(m.leads) > 0 ? Number(m.investimento) / Number(m.leads) : null;
                        return (
                          <tr
                            key={m.data + m.plataforma + idx}
                            className="transition-colors hover:bg-secondary/30"
                          >
                            <td className="px-4 py-2.5 text-[10px] font-black tabular-nums text-muted-foreground/30">
                              {String(idx + 1).padStart(2, "0")}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground">{m.data}</td>
                            <td className="px-4 py-2.5 capitalize">{m.plataforma}</td>
                            <td className="px-4 py-2.5 font-medium tabular-nums">
                              {fmtCurrency(Number(m.investimento))}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums">{m.leads}</td>
                            <td className="px-4 py-2.5 font-semibold tabular-nums text-sky-800">
                              {rowCaq != null ? fmtCurrency(rowCaq) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {metricas.length > 5 ? (
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>+{metricas.length - 5} registros</span>
                    <button
                      type="button"
                      onClick={() => setTab("marketing")}
                      className="inline-flex items-center gap-1 font-semibold text-sky-700 hover:underline"
                    >
                      Ver anúncios <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
              </Panel>
            </>
          ) : null}

          {tab === "oportunidades" ? (
            <div className="space-y-4">
              <StoryBanner
                title={`${leadsCrm} oportunidades no funil`}
                body={`${convertidos} já viraram paciente e ${perdidos} foram perdidas. Use o funil para ver onde a equipe deve atacar.`}
                tone={convertidos > 0 ? "good" : "info"}
              />
              <InsightStack items={funnelInsights} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Funil" tone="soft">
                  <FunnelBars stages={funnel} />
                </Panel>
                <Panel title="Status">
                  <StatusChips items={statusBreakdown} />
                </Panel>
              </div>
              <Link
                to="/cliente/leads"
                search={{ periodo: 30, canal: "", q: "" }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
              >
                Abrir leads <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}

          {tab === "campanhas" ? (
            <div className="space-y-4">
              <InsightStack items={campaignInsights} />
              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Budget por campanha" tone="soft">
                  <RankedBarChart
                    data={campaignSpendChart}
                    formatValue={(v) => fmtMoneyCompact(v)}
                    color={["#0369a1", "#0284c7", "#0ea5e9", "#38bdf8"]}
                  />
                </Panel>
                <Panel title="Leads por campanha">
                  <RankedBarChart
                    data={campaignLeadsChart}
                    color={["#0f766e", "#14b8a6", "#2dd4bf", "#5eead4"]}
                  />
                </Panel>
              </div>
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-secondary/50 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 text-left">Campanha</th>
                      <th className="px-4 py-2.5 text-right">Investimento</th>
                      <th className="px-4 py-2.5 text-right">Leads</th>
                      <th className="px-4 py-2.5 text-right">CAQ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {byCampanha.map((row) => (
                      <tr key={row.campanha} className="hover:bg-secondary/30">
                        <td className="px-4 py-3 font-medium">{row.campanha}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {fmtCurrency(row.investimento)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">{row.leads}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {row.caq != null ? fmtCurrency(row.caq) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => setTab("marketing")}
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
              >
                Ver métricas por anúncio <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
