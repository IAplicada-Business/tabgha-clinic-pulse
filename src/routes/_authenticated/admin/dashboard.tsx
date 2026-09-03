import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, Users, UserPlus, Layers, PackageOpen } from "lucide-react";
import { differenceInDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

import {
  AnalyticsFilters,
  defaultAnalyticsFilters,
  type AnalyticsFiltersValue,
} from "@/components/analytics/AnalyticsFilters";
import { InsightStack, Panel, StoryBanner } from "@/components/analytics/InsightPanel";
import { KpiCard } from "@/components/ui/kpi-card";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { FinanceiroCards } from "@/components/financeiro/FinanceiroCards";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  component: DashboardTabghaPage,
  head: () => ({ meta: [{ title: "Dashboard · Tabgha OS" }] }),
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
            .in("status", ["rascunho", "pendente_aprovacao", "pedir_ajuste"])
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
        rascunho: (conteudosRes.data ?? []).filter((c) => c.status === "rascunho").length,
        pendente: (conteudosRes.data ?? []).filter((c) => c.status === "pendente_aprovacao").length,
        ajuste: (conteudosRes.data ?? []).filter((c) => c.status === "pedir_ajuste").length,
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
        stageTotal: stageCounts.rascunho + stageCounts.pendente + stageCounts.ajuste,
        conteudosPendentes: conteudosRes.data ?? [],
      };
    },
  });

  return (
    <div className="space-y-4 px-6 py-6">
      <header className="animate-fade-up">
        <h1 className="text-xl font-bold tracking-tight">Dashboard Tabgha</h1>
        <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
          Crescimento da agência e gestão da carteira. Mídia e CAQ ficam em ROI e Marketing Pago.
        </p>
      </header>
      <FinanceiroCards />

      <AnalyticsFilters
        value={filters}
        onChange={setFilters}
        clientes={clientesOptions}
        categorias={categorias}
        showPlataforma={false}
      />

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
            label: "Clientes na carteira",
            hint: "ativo + onboarding",
            value: data?.carteira ?? 0,
            icon: Users,
            tint: "blue" as const,
          },
          {
            label: "Em onboarding",
            hint: "ainda não ativados",
            value: data?.onboarding ?? 0,
            icon: UserPlus,
            tint: "sky" as const,
          },
          {
            label: "Leads no CRM",
            hint: "período filtrado",
            value: data?.leadsPeriodo ?? 0,
            icon: Layers,
            tint: "violet" as const,
          },
          {
            label: "Entregas em aberto",
            hint: "pendente / revisão",
            value: data?.entregasPendentes ?? 0,
            icon: PackageOpen,
            tint: "amber" as const,
          },
        ].map((card, i) => (
          <div
            key={card.label}
            className="animate-fade-up"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <KpiCard
              label={card.label}
              value={card.value}
              icon={card.icon}
              tint={card.tint}
              format="raw"
              loading={isLoading}
              delta={{ value: card.hint, direction: "neutral" }}
            />
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
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
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
                <tr className="border-b border-border bg-secondary/40 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                  <th className="px-6 py-3 text-left">Cliente</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Leads/filtro</th>
                  <th className="px-4 py-3 text-left">Último lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
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
                          "transition-colors hover:bg-secondary/40",
                          c.atencao && "bg-amber-50/40",
                        )}
                      >
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="icon-chip icon-chip-blue h-8 w-8 shrink-0 text-[11px] font-bold">
                              {c.nome.slice(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <Link
                                to={"/admin/clientes/$id" as never}
                                params={{ id: c.id } as never}
                                className="block truncate text-[13px] font-semibold hover:text-primary"
                              >
                                {c.nome}
                              </Link>
                              <p className="truncate text-[10.5px] text-muted-foreground">
                                {c.especialidade ?? "—"}
                              </p>
                            </div>
                          </div>
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
                key: "rascunho",
                label: "Rascunho",
                count: data?.stageCounts.rascunho ?? 0,
                color: "bg-slate-400",
              },
              {
                key: "pendente_aprovacao",
                label: "Pendente aprovação",
                count: data?.stageCounts.pendente ?? 0,
                color: "bg-primary",
              },
              {
                key: "pedir_ajuste",
                label: "Pedir ajuste",
                count: data?.stageCounts.ajuste ?? 0,
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
            className="card-lift group rounded-2xl border border-border/70 bg-card p-4 shadow-[var(--shadow-card)] transition hover:border-primary/30"
          >
            <p className="text-sm font-bold">{card.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{card.body}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
              Abrir{" "}
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
