import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  MessageCircle,
  CheckCircle2,
  ArrowRight,
  Clock,
  Calendar,
  Users,
  UserPlus,
  PackageOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/ui/kpi-card";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cliente/dashboard")({
  component: ClienteDashboard,
  head: () => ({ meta: [{ title: "Portal do cliente · Tabgha OS" }] }),
});

function ClienteDashboard() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: counts, isLoading: loadingCounts } = useQuery({
    queryKey: ["cliente", "dashboard", "counts", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const [leadsRes, novosMesRes, entregasRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId!),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId!).gte("criado_em", startOfMonth.toISOString()),
        supabase.from("entregas").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId!).eq("status", "pendente"),
      ]);
      return {
        leads: leadsRes.count ?? 0,
        novos_mes: novosMesRes.count ?? 0,
        entregas_pendentes: entregasRes.count ?? 0,
      };
    },
  });

  const { data: onboarding } = useQuery({
    queryKey: ["cliente", "dashboard", "onboarding", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const [{ data: cliente }, { data: instance }, conteudosPendentes] = await Promise.all([
        supabase
          .from("clientes")
          .select("status, diagnostico, dados_extras")
          .eq("id", clienteId!)
          .single(),
        supabase
          .from("whatsapp_instances")
          .select("status")
          .eq("cliente_id", clienteId!)
          .eq("status", "connected")
          .maybeSingle(),
        supabase
          .from("conteudos")
          .select("id", { count: "exact", head: true })
          .eq("cliente_id", clienteId!)
          .eq("status", "pendente_aprovacao"),
      ]);

      const redes = ((cliente?.dados_extras as Record<string, unknown> | null)?.redes ??
        {}) as Record<string, string>;
      const hasRedes = Boolean(
        redes.instagram || redes.facebook || redes.site || redes.google_review,
      );
      const steps = [
        {
          id: "diagnostico",
          label: "Diagnóstico preenchido",
          done: Boolean(cliente?.diagnostico),
          to: "/cliente/diagnostico" as const,
        },
        {
          id: "whatsapp",
          label: "WhatsApp conectado",
          done: Boolean(instance),
          to: "/cliente/conexoes" as const,
        },
        {
          id: "redes",
          label: "Redes / Google review",
          done: hasRedes,
          to: "/cliente/conexoes" as const,
        },
        {
          id: "conteudo",
          label: "Sem conteúdo pendente",
          done: (conteudosPendentes.count ?? 0) === 0,
          to: "/cliente/conteudo" as const,
        },
      ];

      const doneCount = steps.filter((s) => s.done).length;
      return {
        status: cliente?.status ?? null,
        steps,
        doneCount,
        total: steps.length,
        complete: doneCount === steps.length,
      };
    },
  });

  const { data: proximos, isLoading: loadingAgendamentos } = useQuery({
    queryKey: ["cliente", "dashboard", "agendamentos", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("agendamentos")
        .select("id, titulo, inicio, tipo")
        .eq("cliente_id", clienteId!)
        .eq("visivel_cliente", true)
        .gte("inicio", new Date().toISOString())
        .order("inicio")
        .limit(3);
      return data ?? [];
    },
  });

  const { data: aprovacoes, isLoading: loadingAprovacoes } = useQuery({
    queryKey: ["cliente", "dashboard", "aprovacoes", clienteId],
    enabled: !!clienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("conteudos")
        .select("id, titulo, rede, tipo, data_postagem")
        .eq("cliente_id", clienteId!)
        .eq("status", "pendente_aprovacao")
        .order("data_postagem", { ascending: true, nullsFirst: false })
        .limit(4);
      return data ?? [];
    },
  });

  const { data: conversas, isLoading: loadingConversas } = useQuery({
    queryKey: ["cliente", "dashboard", "conversas", clienteId],
    enabled: !!clienteId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_conversations")
        .select("id, contact_name, contact_phone, last_inbound_at, atualizado_em")
        .eq("cliente_id", clienteId!)
        .order("atualizado_em", { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const kpiCards = [
    {
      label: "Leads totais",
      value: counts?.leads ?? 0,
      icon: Users,
      tint: "blue" as const,
      delay: 0,
      to: "/cliente/leads" as const,
    },
    {
      label: "Novos este mês",
      value: counts?.novos_mes ?? 0,
      icon: UserPlus,
      tint: "green" as const,
      delay: 75,
      to: "/cliente/leads" as const,
    },
    {
      label: "Entregas pendentes",
      value: counts?.entregas_pendentes ?? 0,
      icon: PackageOpen,
      tint: (counts?.entregas_pendentes ?? 0) > 0 ? ("amber" as const) : ("blue" as const),
      delay: 150,
      to: "/cliente/entregas" as const,
    },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      <header className="animate-fade-up">
        <span className="eyebrow-pill">Portal do Cliente</span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Dashboard</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Visão geral da sua operação de marketing</p>
      </header>

      {onboarding && !onboarding.complete ? (
        <div className="animate-fade-up rounded-2xl border border-sky-100 bg-sky-50/70 p-5 shadow-[var(--shadow-card)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-700">Onboarding</p>
              <p className="mt-1 text-sm font-medium">
                Complete a configuração do consultório ({onboarding.doneCount}/{onboarding.total})
              </p>
            </div>
            <Link to="/cliente/conexoes" className="text-xs text-primary hover:underline">
              Ir para conexões
            </Link>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {onboarding.steps.map((step) => (
              <Link
                key={step.id}
                to={step.to}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                  step.done
                    ? "border-emerald-100 bg-emerald-50/80 text-emerald-800"
                    : "border-border bg-card text-foreground hover:bg-secondary/40",
                )}
              >
                <CheckCircle2 className={cn("h-4 w-4", step.done ? "text-emerald-600" : "text-muted-foreground/40")} />
                {step.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {kpiCards.map((card) => (
          <Link key={card.label} to={card.to} className="animate-fade-up block" style={{ animationDelay: `${card.delay}ms` }}>
            <KpiCard
              label={card.label}
              value={card.value}
              icon={card.icon}
              tint={card.tint}
              format="raw"
              loading={loadingCounts}
            />
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Aprovações pendentes */}
        <div className="animate-fade-up delay-225 card-lift rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Aprovações pendentes</p>
              {(aprovacoes?.length ?? 0) > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 px-1.5 text-[11px] font-bold text-amber-700">
                  {aprovacoes!.length}
                </span>
              )}
            </div>
            <Link to="/cliente/conteudo" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Revisar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loadingAprovacoes ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (aprovacoes ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-2" />
              <p className="text-sm font-medium">Tudo aprovado!</p>
              <p className="text-xs text-muted-foreground mt-0.5">Nenhum conteúdo aguarda revisão</p>
            </div>
          ) : (
            <div className="space-y-2">
              {aprovacoes!.map((c, i) => (
                <Link
                  key={c.id}
                  to="/cliente/conteudo"
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/60 px-3.5 py-2.5",
                    "hover:bg-amber-100/60 hover:border-amber-200 transition-all duration-150",
                    "animate-fade-up",
                  )}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.titulo ?? "Sem título"}</p>
                    <p className="text-[10.5px] text-muted-foreground">{[c.rede, c.tipo].filter(Boolean).join(" · ")}</p>
                  </div>
                  {c.data_postagem && (
                    <span className="shrink-0 flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                      <Clock className="h-2.5 w-2.5" />
                      {format(new Date(c.data_postagem), "dd MMM", { locale: ptBR })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Conversas recentes */}
        <div className="animate-fade-up delay-300 card-lift rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Conversas recentes</p>
            <Link to="/cliente/atendimento" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {loadingConversas ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (conversas ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma conversa recente</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
              {conversas!.map((c, i) => (
                <Link
                  key={c.id}
                  to="/cliente/atendimento"
                  className={cn(
                    "flex items-center gap-3 px-4 py-3",
                    "hover:bg-secondary/30 transition-colors duration-150",
                    "animate-fade-up",
                  )}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="icon-chip icon-chip-blue h-8 w-8 shrink-0 rounded-full text-[12px] font-bold">
                    {(c.contact_name ?? c.contact_phone ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.contact_name ?? c.contact_phone}</p>
                    <p className="truncate text-[10.5px] text-muted-foreground">{c.contact_phone}</p>
                  </div>
                  {c.atualizado_em && (
                    <span className="shrink-0 text-[10.5px] text-muted-foreground">
                      {formatDistanceToNow(new Date(c.atualizado_em), { locale: ptBR, addSuffix: false })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Próximos agendamentos */}
      <div className="animate-fade-up delay-375">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Próximos agendamentos</p>
          <Link to="/cliente/calendario" className="flex items-center gap-1 text-xs text-primary hover:underline">
            Ver calendário <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {loadingAgendamentos ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (proximos ?? []).length === 0 ? (
          <EmptyState icon={<Calendar className="h-5 w-5" />} title="Nenhum agendamento próximo" />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {proximos!.map((ag, i) => (
              <div
                key={ag.id}
                className="card-lift animate-fade-up rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-card)]"
                style={{ animationDelay: `${420 + i * 60}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="icon-chip icon-chip-blue h-11 w-11 shrink-0 flex-col">
                    {ag.inicio ? (
                      <>
                        <span className="text-base font-extrabold leading-none">{format(new Date(ag.inicio), "dd")}</span>
                        <span className="text-[9px] font-semibold uppercase opacity-70">{format(new Date(ag.inicio), "MMM", { locale: ptBR })}</span>
                      </>
                    ) : "—"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{ag.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ag.tipo ?? "Reunião"}</p>
                    {ag.inicio && (
                      <p className="text-[10.5px] text-primary mt-1 font-medium">
                        {format(new Date(ag.inicio), "HH:mm")}h
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
