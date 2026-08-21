import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Eye, Loader2, RefreshCw, Target, Users, Wallet } from "lucide-react";

import {
  AnalyticsFilters,
  defaultAnalyticsFilters,
  type AnalyticsFiltersValue,
} from "@/components/analytics/AnalyticsFilters";
import {
  InsightStack,
  Panel,
  RankedBarChart,
  StoryBanner,
} from "@/components/analytics/InsightPanel";
import { KpiCard } from "@/components/ui/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import {
  buildAdInsights,
  buildCampaignInsights,
  fmtMoneyCompact,
} from "@/lib/analytics-insights";
import { calcCaq } from "@/lib/analytics-range";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, META_TOOLTIP_STYLE } from "@/lib/types";

type MetaAdsPageProps = {
  isAdmin?: boolean;
  fixedClienteId?: string | null;
  /** When true, hides page chrome that duplicates the parent ROI shell. */
  embedded?: boolean;
  /** Prefer ad view when opened from Marketing pago. */
  defaultTab?: "campanhas" | "anuncios";
};

type TabId = "campanhas" | "anuncios";

type Metrica = {
  data: string;
  campanha: string | null;
  ad_id: string | null;
  anuncio: string | null;
  nivel: string | null;
  investimento: number;
  leads: number;
  impressoes: number | null;
  cliques: number | null;
  cpl: number | null;
};

function isCampaignRow(m: Metrica) {
  return (m.ad_id ?? "").trim() === "";
}

function isAdRow(m: Metrica) {
  return (m.ad_id ?? "").trim() !== "";
}

export function MetaAdsPage({
  isAdmin = false,
  fixedClienteId = null,
  embedded = false,
  defaultTab = "anuncios",
}: MetaAdsPageProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabId>(defaultTab);
  const [filters, setFilters] = useState<AnalyticsFiltersValue>(() => ({
    ...defaultAnalyticsFilters("30d"),
    clienteId: fixedClienteId,
    plataforma: "meta",
  }));
  const { data: clientesOptions = [] } = useClientesOptions();

  const activeClienteId =
    fixedClienteId ?? filters.clienteId ?? (!isAdmin ? (profile?.cliente_id ?? null) : null);

  useEffect(() => {
    setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (fixedClienteId) {
      setFilters((f) => ({ ...f, clienteId: fixedClienteId }));
    }
  }, [fixedClienteId]);

  useEffect(() => {
    if (fixedClienteId || !isAdmin || filters.clienteId) return;
    const pedro = clientesOptions.find((c) => /pedro/i.test(c.nome));
    const pick = pedro?.id ?? clientesOptions[0]?.id ?? null;
    if (pick) setFilters((f) => ({ ...f, clienteId: pick }));
  }, [fixedClienteId, isAdmin, filters.clienteId, clientesOptions]);

  const syncMutation = useMutation({
    mutationFn: async () => {
      if (!activeClienteId) throw new Error("Selecione um cliente");
      const { data, error } = await supabase.functions.invoke("sync_ads_metrics", {
        body: {
          cliente_id: activeClienteId,
          since: filters.range.since,
          until: filters.range.until,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["marketing-pago"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "roi"] });
      void queryClient.invalidateQueries({ queryKey: ["cliente", "roi"] });
    },
  });

  const dataQuery = useQuery({
    queryKey: ["marketing-pago", activeClienteId, filters.range],
    enabled: Boolean(activeClienteId),
    queryFn: async () => {
      const start = filters.range.since;
      const end = filters.range.until;

      const prevStartDate = new Date(`${start}T00:00:00Z`);
      const prevEndDate = new Date(`${end}T00:00:00Z`);
      const days =
        Math.floor((prevEndDate.getTime() - prevStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const prevStart = new Date(prevStartDate);
      prevStart.setDate(prevStart.getDate() - days);
      const prevEnd = new Date(prevEndDate);
      prevEnd.setDate(prevEnd.getDate() - days);
      const prevStartIso = prevStart.toISOString().slice(0, 10);
      const prevEndIso = prevEnd.toISOString().slice(0, 10);

      const { data: metrics, error: metricsErr } = await supabase
        .from("metricas_ads")
        .select("data,campanha,ad_id,anuncio,nivel,investimento,leads,impressoes,cliques,cpl")
        .eq("cliente_id", activeClienteId!)
        .eq("plataforma", "meta")
        .gte("data", prevStartIso)
        .lte("data", end)
        .order("data", { ascending: true });

      if (metricsErr) throw metricsErr;

      const allMetrics = (metrics ?? []) as Metrica[];
      const inCurrent = (date: string) => date >= start && date <= end;
      const inPrev = (date: string) => date >= prevStartIso && date <= prevEndIso;

      const currentAll = allMetrics.filter((m) => inCurrent(m.data));
      const previousAll = allMetrics.filter((m) => inPrev(m.data));
      const currentCampaigns = currentAll.filter(isCampaignRow);
      const previousCampaigns = previousAll.filter(isCampaignRow);
      const currentAds = currentAll.filter(isAdRow);

      const sum = (rows: Metrica[]) => ({
        investimento: rows.reduce((s, m) => s + Number(m.investimento ?? 0), 0),
        leadsAds: rows.reduce((s, m) => s + Number(m.leads ?? 0), 0),
        impressoes: rows.reduce((s, m) => s + Number(m.impressoes ?? 0), 0),
        cliques: rows.reduce((s, m) => s + Number(m.cliques ?? 0), 0),
      });

      const cur = sum(currentCampaigns);
      const prev = sum(previousCampaigns);
      const caq = calcCaq(cur.investimento, cur.leadsAds);
      const prevCaq = calcCaq(prev.investimento, prev.leadsAds);

      const byDay = new Map<string, { data: string; investimento: number; leads: number }>();
      for (const row of currentCampaigns) {
        if (!byDay.has(row.data))
          byDay.set(row.data, { data: row.data, investimento: 0, leads: 0 });
        const t = byDay.get(row.data)!;
        t.investimento += Number(row.investimento ?? 0);
        t.leads += Number(row.leads ?? 0);
      }

      const byCampaign = new Map<
        string,
        { campanha: string; investimento: number; leads: number; impressoes: number; cliques: number }
      >();
      for (const row of currentCampaigns) {
        const key = row.campanha ?? "Sem campanha";
        if (!byCampaign.has(key)) {
          byCampaign.set(key, {
            campanha: key,
            investimento: 0,
            leads: 0,
            impressoes: 0,
            cliques: 0,
          });
        }
        const t = byCampaign.get(key)!;
        t.investimento += Number(row.investimento ?? 0);
        t.leads += Number(row.leads ?? 0);
        t.impressoes += Number(row.impressoes ?? 0);
        t.cliques += Number(row.cliques ?? 0);
      }

      const campaigns = [...byCampaign.values()]
        .map((c) => ({
          ...c,
          caq: calcCaq(c.investimento, c.leads),
          cpl: calcCaq(c.investimento, c.leads),
        }))
        .sort((a, b) => b.investimento - a.investimento);

      const byAd = new Map<
        string,
        {
          ad_id: string;
          anuncio: string;
          campanha: string;
          investimento: number;
          leads: number;
          impressoes: number;
          cliques: number;
        }
      >();
      for (const row of currentAds) {
        const adId = (row.ad_id ?? "").trim();
        if (!adId) continue;
        const prevRow = byAd.get(adId) ?? {
          ad_id: adId,
          anuncio: row.anuncio?.trim() || `Anúncio ${adId}`,
          campanha: row.campanha ?? "—",
          investimento: 0,
          leads: 0,
          impressoes: 0,
          cliques: 0,
        };
        prevRow.investimento += Number(row.investimento ?? 0);
        prevRow.leads += Number(row.leads ?? 0);
        prevRow.impressoes += Number(row.impressoes ?? 0);
        prevRow.cliques += Number(row.cliques ?? 0);
        if (row.anuncio?.trim()) prevRow.anuncio = row.anuncio.trim();
        if (row.campanha) prevRow.campanha = row.campanha;
        byAd.set(adId, prevRow);
      }

      const anuncios = [...byAd.values()]
        .map((a) => ({
          ...a,
          caq: calcCaq(a.investimento, a.leads),
          ctr: a.impressoes > 0 ? (a.cliques / a.impressoes) * 100 : null,
        }))
        .sort((a, b) => b.investimento - a.investimento || b.leads - a.leads);

      return {
        current: {
          investimento: cur.investimento,
          leadsAds: cur.leadsAds,
          impressoes: cur.impressoes,
          cliques: cur.cliques,
          caq,
          cpl: calcCaq(cur.investimento, cur.leadsAds),
        },
        previous: {
          investimento: prev.investimento,
          leadsAds: prev.leadsAds,
          caq: prevCaq,
        },
        chart: [...byDay.values()],
        campaigns,
        anuncios,
      };
    },
  });

  const cards = useMemo(() => {
    const current = dataQuery.data?.current;
    if (!current) return [];
    return [
      {
        label: "Investimento",
        value: formatCurrency(current.investimento),
        icon: Wallet,
        tint: "blue" as const,
      },
      { label: "Leads (Ads)", value: String(current.leadsAds), icon: Users, tint: "sky" as const },
      {
        label: "CAQ",
        value: current.caq != null ? formatCurrency(current.caq) : "—",
        icon: Target,
        tint: "amber" as const,
      },
      {
        label: "Impressões",
        value: current.impressoes > 0 ? current.impressoes.toLocaleString("pt-BR") : "—",
        icon: Eye,
        tint: "violet" as const,
      },
    ];
  }, [dataQuery.data]);

  const campaignInsights = buildCampaignInsights(dataQuery.data?.campaigns ?? []);
  const adInsights = buildAdInsights(
    (dataQuery.data?.anuncios ?? []).map((a) => ({
      anuncio: a.anuncio,
      campanha: a.campanha,
      leads: a.leads,
      investimento: a.investimento,
    })),
  );

  const campaignSpendChart = (dataQuery.data?.campaigns ?? []).slice(0, 8).map((c) => ({
    name: c.campanha.length > 22 ? `${c.campanha.slice(0, 20)}…` : c.campanha,
    value: c.investimento,
  }));
  const campaignLeadsChart = (dataQuery.data?.campaigns ?? []).slice(0, 8).map((c) => ({
    name: c.campanha.length > 22 ? `${c.campanha.slice(0, 20)}…` : c.campanha,
    value: c.leads,
  }));
  const adSpendChart = (dataQuery.data?.anuncios ?? []).slice(0, 10).map((a) => ({
    name: a.anuncio.length > 22 ? `${a.anuncio.slice(0, 20)}…` : a.anuncio,
    value: a.investimento,
  }));
  const adLeadsChart = (dataQuery.data?.anuncios ?? []).slice(0, 10).map((a) => ({
    name: a.anuncio.length > 22 ? `${a.anuncio.slice(0, 20)}…` : a.anuncio,
    value: a.leads,
  }));

  if (isAdmin && !fixedClienteId && clientesOptions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">
          Nenhum cliente cadastrado. Crie um cliente e conecte a Meta BM primeiro.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!embedded ? (
          <div>
            <h2 className="text-xl font-bold tracking-tight">Marketing pago</h2>
          </div>
        ) : (
          <div
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground"
            role="tablist"
            aria-label="Nível de mídia"
          >
            {(
              [
                ["campanhas", "Campanhas"],
                ["anuncios", "Anúncios"],
              ] as const
            ).map(([id, label], index) => (
              <span key={id} className="inline-flex items-center gap-1">
                {index > 0 ? <span className="text-border">·</span> : null}
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "rounded px-1.5 py-0.5 transition-colors",
                    tab === id
                      ? "font-semibold text-foreground"
                      : "hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {!embedded ? (
            <div
              className="mr-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground"
              role="tablist"
              aria-label="Nível de mídia"
            >
              {(
                [
                  ["campanhas", "Campanhas"],
                  ["anuncios", "Anúncios"],
                ] as const
              ).map(([id, label], index) => (
                <span key={id} className="inline-flex items-center gap-1">
                  {index > 0 ? <span className="text-border">·</span> : null}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                    className={cn(
                      "rounded px-1.5 py-0.5 transition-colors",
                      tab === id
                        ? "font-semibold text-foreground"
                        : "hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <AnalyticsFilters
            value={filters}
            onChange={setFilters}
            clientes={clientesOptions}
            showCliente={isAdmin && !fixedClienteId}
            showCategoria={false}
            showPlataforma={false}
          />
          <button
            type="button"
            disabled={!activeClienteId || syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary/60 disabled:opacity-50"
          >
            {syncMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Sincronizar Meta
          </button>
        </div>
      </div>

      {syncMutation.isError ? (
        <p className="text-xs text-destructive">{(syncMutation.error as Error).message}</p>
      ) : null}
      {syncMutation.isSuccess ? (
        <p className="text-xs text-emerald-700">
          Sync concluído. Se a visão de anúncios estiver vazia, rode de novo no período com entrega
          ou confira permissão ads_read na conta vinculada.
        </p>
      ) : null}

      {!activeClienteId ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-sm text-muted-foreground">Selecione um cliente para ver os KPIs.</p>
        </div>
      ) : dataQuery.isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      ) : dataQuery.isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
          <p className="text-sm text-destructive">{(dataQuery.error as Error).message}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            {cards.map((card, i) => (
              <div key={card.label} className="animate-fade-up" style={{ animationDelay: `${i * 60}ms` }}>
                <KpiCard
                  label={card.label}
                  value={card.value}
                  icon={card.icon}
                  tint={card.tint}
                  format="raw"
                />
              </div>
            ))}
          </div>

          {tab === "campanhas" ? (
            <>
              <InsightStack items={campaignInsights} />

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel
                  title="Investimento × Leads (diário)"
                  subtitle="Série da Meta no período"
                  tone="soft"
                >
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dataQuery.data?.chart ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis
                          dataKey="data"
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="left"
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip contentStyle={META_TOOLTIP_STYLE} />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="investimento"
                          name="Investimento"
                          stroke="#0369a1"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="leads"
                          name="Leads Ads"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel title="Leads por dia" subtitle="Volume diário reportado pela Meta">
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dataQuery.data?.chart ?? []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis
                          dataKey="data"
                          tick={{ fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={META_TOOLTIP_STYLE} />
                        <Bar dataKey="leads" fill="#0284c7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Budget por campanha" subtitle="Quem leva o investimento" tone="soft">
                  <RankedBarChart
                    data={campaignSpendChart}
                    formatValue={(v) => fmtMoneyCompact(v)}
                    color={["#0369a1", "#0284c7", "#0ea5e9", "#38bdf8", "#7dd3fc"]}
                  />
                </Panel>
                <Panel title="Leads por campanha" subtitle="Quem traz volume">
                  <RankedBarChart
                    data={campaignLeadsChart}
                    color={["#0f766e", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4"]}
                  />
                </Panel>
              </div>

              <Panel title="Tabela de campanhas" subtitle="Nível campanha (sem duplicar anúncios)">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campanha</TableHead>
                      <TableHead className="text-right">Investimento</TableHead>
                      <TableHead className="text-right">Leads</TableHead>
                      <TableHead className="text-right">Impressões</TableHead>
                      <TableHead className="text-right">Cliques</TableHead>
                      <TableHead className="text-right">CAQ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(dataQuery.data?.campaigns ?? []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          Sem campanhas no período — sincronize a Meta BM.
                        </TableCell>
                      </TableRow>
                    ) : (
                      (dataQuery.data?.campaigns ?? []).map((row) => (
                        <TableRow key={row.campanha}>
                          <TableCell className="font-medium">{row.campanha}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.investimento)}
                          </TableCell>
                          <TableCell className="text-right">{row.leads}</TableCell>
                          <TableCell className="text-right">
                            {row.impressoes.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.cliques.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.caq != null ? formatCurrency(row.caq) : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </Panel>
            </>
          ) : null}

          {tab === "anuncios" ? (
            <>
              <StoryBanner
                title={
                  (dataQuery.data?.anuncios ?? []).length > 0
                    ? "Métricas por anúncio da Meta"
                    : "Ainda sem linhas de anúncio neste período"
                }
                body={
                  (dataQuery.data?.anuncios ?? []).length > 0
                    ? "Investimento, leads, impressões e cliques por criativo — vindos do sync level=ad. Use para escalar ou pausar peças sem abrir o Ads Manager."
                    : "Clique em Sincronizar Meta para buscar insights no nível anúncio. Se campanhas já existem e anúncios não, a conta pode não ter breakdown por ad liberado."
                }
                tone={(dataQuery.data?.anuncios ?? []).length > 0 ? "good" : "warn"}
              />
              <InsightStack items={adInsights} />

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Investimento por anúncio" subtitle="Budget no criativo" tone="soft">
                  <RankedBarChart
                    data={adSpendChart}
                    formatValue={(v) => fmtMoneyCompact(v)}
                    color={["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"]}
                  />
                </Panel>
                <Panel title="Leads por anúncio" subtitle="Volume reportado pela Meta">
                  <RankedBarChart
                    data={adLeadsChart}
                    color={["#0f766e", "#14b8a6", "#2dd4bf", "#5eead4", "#99f6e4"]}
                  />
                </Panel>
              </div>

              <Panel title="Detalhe por anúncio" subtitle="Lista completa do período">
                {(dataQuery.data?.anuncios ?? []).length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Sem anúncios sincronizados neste período.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Anúncio</TableHead>
                        <TableHead>Campanha</TableHead>
                        <TableHead className="text-right">Investimento</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Impressões</TableHead>
                        <TableHead className="text-right">Cliques</TableHead>
                        <TableHead className="text-right">CTR</TableHead>
                        <TableHead className="text-right">CAQ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dataQuery.data!.anuncios.map((row) => (
                        <TableRow key={row.ad_id}>
                          <TableCell className="font-medium">{row.anuncio}</TableCell>
                          <TableCell className="text-muted-foreground">{row.campanha}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(row.investimento)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">{row.leads}</TableCell>
                          <TableCell className="text-right">
                            {row.impressoes.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.cliques.toLocaleString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.ctr != null ? `${row.ctr.toFixed(2)}%` : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.caq != null ? formatCurrency(row.caq) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Panel>
            </>
          ) : null}

          {isAdmin && !embedded ? (
            <Link
              to="/admin/roi"
              search={{ tab: "clientes" }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 hover:underline"
            >
              Ver clientes no ROI <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </>
      )}
    </div>
  );
}
