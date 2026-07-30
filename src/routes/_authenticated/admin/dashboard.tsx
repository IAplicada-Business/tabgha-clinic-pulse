import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2 } from "lucide-react";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  AnalyticsFilters,
  defaultAnalyticsFilters,
  type AnalyticsFiltersValue,
} from "@/components/analytics/AnalyticsFilters";
import { InsightStack, Panel, StoryBanner } from "@/components/analytics/InsightPanel";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: DashboardTabghaPage,
  head: () => ({ meta: [{ title: "Dashboard Tabgha — Admin" }] }),
});

const CLIENTE_STATUS: Record<string, { dot: string; label: string; text: string }> = {
  ativo: { dot: "bg-emerald-400", label: "Ativo", text: "text-emerald-700" },
  onboarding: { dot: "bg-sky-400", label: "Onboarding", text: "text-sky-700" },
  pausa: { dot: "bg-amber-400", label: "Pausa", text: "text-amber-700" },
  inativo: { dot: "bg-slate-400", label: "Inativo", text: "text-slate-600" },
};

function ultimoLeadColor(d: string | null) {
  if (!d) return "text-muted-foreground/40";
  const days = differenceInDays(new Date(), new Date(d));
  if (days <= 7) return "font-semibold text-emerald-600";
  if (days <= 30) return "text-amber-600";
  return "text-rose-500";
}

function DashboardTabghaPage() {
  const [filters, setFilters] = useState<AnalyticsFiltersValue>(defaultAnalyticsFilters("30d"));
  const { data: clientesOptions = [] } = useClientesOptions();

  const { data: clientesFull = [] } = useQuery({
    queryKey: ["admin", "dashboard-tabgha", "clientes-cat"],
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
    queryKey: ["admin", "dashboard-tabgha", filters],
    staleTime: 60_000,
    queryFn: async () => {
      const { since, until } = filters.range;
      const sinceIso = `${since}T00:00:00.000Z`;
      const untilIso = `${until}T23:59:59.999Z`;

      let entregasQ = supabase
        .from("entregas")
        .select("id, cliente_id, status, titulo, criado_em, clientes(nome, especialidade)")
        .order("criado_em", { ascending: false })
        .limit(40);
      if (filters.clienteId) entregasQ = entregasQ.eq("cliente_id", filters.clienteId);

      const [carteiraRes, onboardingRes, leadsRes, entregasRes, conteudosRes, saudeRes] =
        await Promise.all([
          supabase
            .from("clientes")
            .select("id", { count: "exact", head: true })
            .in("status", ["ativo", "onboarding"]),
          supabase
            .from("clientes")
            .select("id", { count: "exact", head: true })
            .eq("status", "onboarding"),
          (() => {
            let q = supabase
              .from("leads")
              .select("id, cliente_id, status, canal, criado_em, clientes(nome, especialidade)")
              .gte("criado_em", sinceIso)
              .lte("criado_em", untilIso);
            if (filters.clienteId) q = q.eq("cliente_id", filters.clienteId);
            return q;
          })(),
          entregasQ,
          supabase
            .from("conteudos")
            .select("id, titulo, status, clientes(nome)")
            .in("status", ["briefing", "roteiro", "producao"])
            .order("criado_em", { ascending: false })
            .limit(8),
          supabase
            .from("clientes")
            .select("id, nome, especialidade, status, leads(id, status, criado_em)")
            .in("status", ["ativo", "onboarding", "pausa"])
            .order("nome")
            .limit(30),
        ]);

      let leads = leadsRes.data ?? [];
      let entregas = entregasRes.data ?? [];
      if (filters.categoria) {
        leads = leads.filter(
          (l) =>
            (l.clientes as { especialidade?: string } | null)?.especialidade === filters.categoria,
        );
        entregas = entregas.filter(
          (e) =>
            (e.clientes as { especialidade?: string } | null)?.especialidade === filters.categoria,
        );
      }

      const entregasPendentes = entregas.filter(
        (e) => e.status === "pendente" || e.status === "em_revisao",
      ).length;

      const saudeCarteira = (saudeRes.data ?? []).map((c) => {
        const leadsC = (Array.isArray(c.leads) ? c.leads : []) as {
          id: string;
          status: string;
          criado_em: string;
        }[];
        const total = leadsC.length;
        const mes = leadsC.filter((l) => l.criado_em >= sinceIso).length;
        const conv = leadsC.filter((l) => l.status === "convertido").length;
        const ultimoLead =
          leadsC.length > 0
            ? leadsC.sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0].criado_em
            : null;
        const diasSemLead = ultimoLead ? differenceInDays(new Date(), new Date(ultimoLead)) : 999;
        return {
          id: c.id,
          nome: c.nome,
          especialidade: c.especialidade,
          status: c.status,
          total,
          mes,
          conv,
          ultimoLead,
          atencao: diasSemLead > 14 || c.status === "onboarding",
        };
      });

      const atencao = saudeCarteira.filter((c) => c.atencao).length;
      const novos = leads.filter((l) => l.status === "novo").length;
      const convertidos = leads.filter((l) => l.status === "convertido").length;

      const stageCounts = {
        briefing: (conteudosRes.data ?? []).filter((c) => c.status === "briefing").length,
        roteiro: (conteudosRes.data ?? []).filter((c) => c.status === "roteiro").length,
        producao: (conteudosRes.data ?? []).filter((c) => c.status === "producao").length,
      };

      return {
        carteira: carteiraRes.count ?? 0,
        onboarding: onboardingRes.count ?? 0,
        leadsPeriodo: leads.length,
        novos,
        convertidos,
        entregasPendentes,
        atencao,
        saudeCarteira,
        stageCounts,
        stageTotal: stageCounts.briefing + stageCounts.roteiro + stageCounts.producao,
        conteudosPendentes: conteudosRes.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-4 px-6 py-6">
      <header className="animate-fade-up flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard Tabgha</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Crescimento da agência e gestão da carteira. Mídia e CAQ ficam em ROI e Marketing Pago.
          </p>
        </div>
        <AnalyticsFilters
          value={filters}
          onChange={setFilters}
          clientes={clientesOptions}
          categorias={categorias}
          showPlataforma={false}
        />
      </header>

      {!isLoading ? (
        <StoryBanner
          title={
            (data?.atencao ?? 0) > 0
              ? `${data!.atencao} cliente(s) pedem atenção da operação`
              : "Carteira sob controle"
          }
          body={
            (data?.atencao ?? 0) > 0
              ? "Priorize onboarding e clínicas sem lead recente. Use Dashboard Clientes para o resumo por clínica e o funil para agir."
              : "Nenhum alerta crítico de carteira no filtro. Bom momento para acelerar entregas e aquisição."
          }
          tone={(data?.atencao ?? 0) > 0 ? "warn" : "good"}
        />
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            rank: "01",
            label: "Clientes na carteira",
            hint: "ativo + onboarding",
            value: data?.carteira ?? 0,
            accent: "text-primary",
            bar: "bg-primary",
          },
          {
            rank: "02",
            label: "Em onboarding",
            hint: "ainda não ativados",
            value: data?.onboarding ?? 0,
            accent: "text-sky-700",
            bar: "bg-sky-500",
          },
          {
            rank: "03",
            label: "Leads no CRM",
            hint: "período filtrado",
            value: data?.leadsPeriodo ?? 0,
            accent: "text-foreground",
            bar: "bg-slate-400",
          },
          {
            rank: "04",
            label: "Entregas em aberto",
            hint: "pendente / revisão",
            value: data?.entregasPendentes ?? 0,
            accent: "text-amber-700",
            bar: "bg-amber-500",
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
            <p className={cn("text-[2rem] font-black leading-none tracking-tighter", card.accent)}>
              {isLoading ? (
                <span className="inline-block h-9 w-16 animate-pulse rounded-lg bg-secondary align-middle" />
              ) : (
                card.value
              )}
            </p>
            <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground/70">{card.hint}</p>
            <div className={cn("mt-4 h-0.5 w-full rounded-full", card.bar)} />
          </div>
        ))}
      </div>

      <InsightStack
        items={[
          {
            title: "Onde olhar cada pilar",
            body: "Este dashboard cuida da agência. Performance por clínica → Dashboard Clientes. Investimento e CAQ → ROI. Campanhas Meta → Marketing Pago. Funil CRM → Funil de leads.",
            tone: "info",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <div>
              <p className="text-sm font-bold">Saúde da carteira</p>
              <p className="text-[11px] text-muted-foreground">
                Quem precisa de gestão — não é ranking de mídia
              </p>
            </div>
            <Link
              to="/admin/clientes"
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Ver clientes <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/20 text-[9.5px] font-black uppercase tracking-[0.1em] text-muted-foreground/60">
                  <th className="px-6 py-2.5 text-left">Cliente</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Leads/filtro</th>
                  <th className="px-4 py-2.5 text-left">Último lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : (data?.saudeCarteira ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">
                      Nenhum cliente na carteira.
                    </td>
                  </tr>
                ) : (
                  data!.saudeCarteira.map((c) => {
                    const st = CLIENTE_STATUS[c.status] ?? CLIENTE_STATUS.inativo;
                    return (
                      <tr
                        key={c.id}
                        className={cn(
                          "transition-colors hover:bg-secondary/30",
                          c.atencao && "bg-amber-50/40",
                        )}
                      >
                        <td className="px-6 py-3.5">
                          <Link
                            to={"/admin/clientes/$id" as never}
                            params={{ id: c.id } as never}
                            className="text-[13px] font-semibold hover:text-primary"
                          >
                            {c.nome}
                          </Link>
                          <p className="text-[10.5px] text-muted-foreground">
                            {c.especialidade ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", st.dot)} />
                            <span className={cn("text-[11px] font-semibold", st.text)}>
                              {st.label}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right text-base font-extrabold tabular-nums text-sky-800">
                          {c.mes}
                        </td>
                        <td
                          className={cn("px-4 py-3.5 text-[11.5px]", ultimoLeadColor(c.ultimoLead))}
                        >
                          {c.ultimoLead
                            ? formatDistanceToNow(new Date(c.ultimoLead), {
                                addSuffix: true,
                                locale: ptBR,
                              })
                            : "sem leads"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <Panel title="Pipeline editorial" subtitle={`${data?.stageTotal ?? 0} em produção`}>
          <div className="space-y-4">
            {[
              {
                key: "briefing",
                label: "Briefing",
                count: data?.stageCounts.briefing ?? 0,
                color: "bg-slate-400",
              },
              {
                key: "roteiro",
                label: "Roteiro",
                count: data?.stageCounts.roteiro ?? 0,
                color: "bg-primary",
              },
              {
                key: "producao",
                label: "Produção",
                count: data?.stageCounts.producao ?? 0,
                color: "bg-amber-400",
              },
            ].map(({ key, label, count, color }) => {
              const total = data?.stageTotal ?? 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={key}>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold">{label}</span>
                    <span className="text-xs font-bold tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", color)}
                      style={{
                        width: total === 0 ? "100%" : `${pct}%`,
                        opacity: total === 0 ? 0.2 : 1,
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <Link
              to="/admin/estrategia"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
            >
              Abrir estratégia <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          {
            title: "Dashboard Clientes",
            body: "Resumo por clínica: leads CRM, gap Ads e próximos passos.",
            to: "/admin/dashboard-clientes",
          },
          {
            title: "ROI da operação",
            body: "Investimento, CAQ e retorno — sem misturar com gestão da carteira.",
            to: "/admin/roi" as const,
            search: { tab: "operacao" as const },
          },
          {
            title: "Funil de leads",
            body: "Mover oportunidades no pipeline de cada cliente.",
            to: "/admin/leads" as const,
            search: undefined,
          },
        ].map((card) => (
          <Link
            key={card.to}
            to={card.to as never}
            search={(card.search ?? {}) as never}
            className="rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <p className="text-sm font-bold">{card.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{card.body}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700">
              Abrir <ArrowRight className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
