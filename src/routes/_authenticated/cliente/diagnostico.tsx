import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cliente/diagnostico")({
  component: DiagnosticoPage,
  head: () => ({ meta: [{ title: "Diagnóstico — Portal" }] }),
});

type DiagnosticoData = {
  resumo?: string;
  perfil?: Record<string, string>;
  jornada?: Record<string, string>;
  dores?: Record<string, string>;
  concorrentes?: string;
  /** legado / interno — nunca renderizar no portal */
  plano_acao?: string;
  demandas_sugeridas?: string;
  [key: string]: unknown;
};

function Field({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

const SECTION_ACCENTS: Record<
  string,
  { dot: string; header: string; text: string; border: string }
> = {
  blue: {
    dot: "bg-blue-500",
    header: "bg-blue-50/60",
    text: "text-blue-700",
    border: "border-blue-100",
  },
  violet: {
    dot: "bg-violet-500",
    header: "bg-violet-50/60",
    text: "text-violet-700",
    border: "border-violet-100",
  },
  rose: {
    dot: "bg-rose-500",
    header: "bg-rose-50/60",
    text: "text-rose-700",
    border: "border-rose-100",
  },
  amber: {
    dot: "bg-amber-500",
    header: "bg-amber-50/60",
    text: "text-amber-700",
    border: "border-amber-100",
  },
};

function Section({
  title,
  accent = "blue",
  children,
  className,
  delay = 0,
}: {
  title: string;
  accent?: keyof typeof SECTION_ACCENTS;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const a = SECTION_ACCENTS[accent];
  return (
    <div
      className={cn(
        "card-lift animate-fade-up overflow-hidden rounded-2xl border border-border bg-card",
        "shadow-[var(--shadow-card)]",
        className,
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={cn("flex items-center gap-2.5 border-b px-5 py-3", a.header, a.border)}>
        <span className={cn("h-2 w-2 shrink-0 rounded-full", a.dot)} />
        <p className={cn("text-[10.5px] font-bold uppercase tracking-widest", a.text)}>{title}</p>
      </div>
      <div className="space-y-4 px-5 py-4">{children}</div>
    </div>
  );
}

const PERFIL_LABELS: Record<string, string> = {
  especialidade: "Especialidade",
  cidade: "Cidade",
  tempo_mercado: "Tempo de mercado",
  publico_alvo: "Público-alvo",
  ticket_medio: "Ticket médio",
  diferencial: "Diferencial",
};

const JORNADA_LABELS: Record<string, string> = {
  canais_aquisicao: "Canais de aquisição",
  funil: "Funil de vendas",
  objecoes: "Objeções frequentes",
  taxa_agendamento: "Taxa de agendamento",
  taxa_conversao: "Taxa de conversão",
};

const DORES_LABELS: Record<string, string> = {
  principais: "Principais dores do paciente",
  marketing: "Dores de marketing",
  operacional: "Dores operacionais",
};

function hasPublicContent(d: DiagnosticoData) {
  return Boolean(
    d.resumo?.trim() ||
    d.perfil?.especialidade ||
    d.dores?.principais ||
    d.jornada?.funil ||
    d.concorrentes,
  );
}

function DiagnosticoPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["cliente", "diagnostico", clienteId],
    enabled: !!clienteId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("nome, especialidade, diagnostico")
        .eq("id", clienteId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const d = cliente?.diagnostico as DiagnosticoData | null | undefined;
  const ready = d && hasPublicContent(d);

  return (
    <div className="space-y-6 px-6 py-6">
      <header className="animate-fade-up">
        <span className="eyebrow-pill mb-2">Estratégia</span>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Diagnóstico</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Análise estratégica do{" "}
          {cliente?.especialidade ? `consultório de ${cliente.especialidade}` : "seu consultório"}
        </p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !ready ? (
        <div
          className="card-lift animate-fade-up overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
          style={{ animationDelay: "75ms" }}
        >
          <div className="flex items-center gap-2.5 border-b border-primary/15 bg-primary/5 px-5 py-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-primary">
              Diagnóstico estratégico
            </p>
          </div>
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="icon-chip icon-chip-blue mb-5 h-16 w-16">
              <Stethoscope className="h-7 w-7" />
            </div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Em preparação
            </p>
            <h3 className="text-base font-semibold">Diagnóstico em breve</h3>
            <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
              A equipe Tabgha está preparando a análise estratégica do seu consultório. Você será
              notificado quando estiver pronto.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {d!.resumo ? (
            <Section title="Visão consolidada" accent="blue" className="lg:col-span-2" delay={50}>
              <p className="whitespace-pre-line text-sm leading-relaxed">{d!.resumo}</p>
            </Section>
          ) : null}

          {d!.perfil ? (
            <Section title="Perfil do consultório" accent="blue" delay={75}>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(PERFIL_LABELS).map(([k, l]) => (
                  <div
                    key={k}
                    className={k === "diferencial" || k === "publico_alvo" ? "col-span-2" : ""}
                  >
                    <Field label={l} value={d!.perfil?.[k]} />
                  </div>
                ))}
              </div>
            </Section>
          ) : null}

          {d!.jornada ? (
            <Section title="Jornada do paciente" accent="violet" delay={150}>
              <div className="grid grid-cols-2 gap-4">
                {["canais_aquisicao", "funil", "objecoes"].map((k) => (
                  <div key={k} className="col-span-2">
                    <Field label={JORNADA_LABELS[k]} value={d!.jornada?.[k]} />
                  </div>
                ))}
                <Field
                  label={JORNADA_LABELS["taxa_agendamento"]}
                  value={d!.jornada?.taxa_agendamento}
                />
                <Field
                  label={JORNADA_LABELS["taxa_conversao"]}
                  value={d!.jornada?.taxa_conversao}
                />
              </div>
            </Section>
          ) : null}

          {d!.dores ? (
            <Section title="Dores identificadas" accent="rose" delay={225}>
              <div className="space-y-4">
                {Object.entries(DORES_LABELS).map(([k, l]) => (
                  <Field key={k} label={l} value={d!.dores?.[k]} />
                ))}
              </div>
            </Section>
          ) : null}

          {d!.concorrentes ? (
            <Section title="Concorrentes & posicionamento" accent="amber" delay={300}>
              <p className="whitespace-pre-line text-sm leading-relaxed">{d!.concorrentes}</p>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}
