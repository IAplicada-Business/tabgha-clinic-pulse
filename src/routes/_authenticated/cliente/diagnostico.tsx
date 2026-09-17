import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, Loader2, RotateCcw, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Wizard7Fontes } from "@/components/diagnostico/Wizard7Fontes";
import { ResultadoFontes } from "@/components/diagnostico/ResultadoFontes";
import { useDiagnostico7Fontes, useRefazerDiagnostico } from "@/hooks/useDiagnostico7Fontes";
import { FONTES_LIST } from "@/lib/fontes";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/cliente/diagnostico")({
  component: DiagnosticoPage,
  head: () => ({ meta: [{ title: "Diagnóstico Estratégico · Tabgha OS" }] }),
});

type Vista = "entrada" | "form" | "resultado";

function DiagnosticoPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id ?? null;
  const [vista, setVista] = useState<Vista>("entrada");
  const [stepInicial, setStepInicial] = useState(0);

  const diag = useDiagnostico7Fontes(clienteId);
  const refazer = useRefazerDiagnostico(clienteId);

  const { data: cliente } = useQuery({
    queryKey: ["cliente", "diagnostico", "dados", clienteId],
    enabled: !!clienteId,
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("nome, especialidade, dados_extras")
        .eq("id", clienteId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Link da sessão de aprofundamento, se a Tabgha tiver cadastrado.
  const urlAgendamento =
    (
      (cliente?.dados_extras as Record<string, unknown> | null)?.agenda as
        Record<string, string> | undefined
    )?.diagnostico ?? null;

  if (!clienteId) {
    return (
      <div className="px-6 py-6">
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a uma clínica. Fale com a equipe Tabgha.
        </p>
      </div>
    );
  }

  if (diag.isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Tela B · formulário ────────────────────────────────────────────────────
  if (vista === "form") {
    return (
      <div className="mx-auto max-w-3xl px-6">
        <Wizard7Fontes
          clienteId={clienteId}
          stepInicial={stepInicial}
          onSair={() => setVista("entrada")}
          onConcluir={() => setVista("resultado")}
        />
      </div>
    );
  }

  // ── Tela C · resultado ─────────────────────────────────────────────────────
  if (vista === "resultado") {
    return (
      <div className="space-y-6 px-6 py-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="eyebrow-pill">Método 7 Fontes™</span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight">
              Seu Diagnóstico Estratégico
            </h1>
            {diag.concluidoEm ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Concluído em {new Date(diag.concluidoEm).toLocaleDateString("pt-BR")}
              </p>
            ) : null}
          </div>
          <Button variant="outline" size="sm" onClick={() => setVista("entrada")}>
            Voltar
          </Button>
        </header>

        <ResultadoFontes
          clienteId={clienteId}
          clienteNome={cliente?.nome ?? "sua clínica"}
          urlAgendamento={urlAgendamento}
        />
      </div>
    );
  }

  // ── Tela A · entrada ───────────────────────────────────────────────────────
  const fonteAtual = FONTES_LIST[diag.primeiraIncompleta];

  return (
    <div className="space-y-6 px-6 py-6">
      <header className="animate-fade-up">
        <span className="eyebrow-pill">Método 7 Fontes™</span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Diagnóstico Estratégico</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Ao completar, você recebe seu mapa de maturidade nas 7 fontes de crescimento previsível na
          saúde.
        </p>
      </header>

      <div
        className="animate-fade-up rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-card)]"
        style={{ animationDelay: "75ms" }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />8 a 12 minutos · 35 perguntas · suas respostas salvam
          sozinhas
        </div>

        {diag.concluido ? (
          /* Estado 3 · concluído */
          <div className="mt-5">
            <p className="text-sm font-semibold text-emerald-700">Diagnóstico concluído</p>
            {diag.concluidoEm ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Em {new Date(diag.concluidoEm).toLocaleDateString("pt-BR")}
                {diag.scoreGeral != null ? ` · nota geral ${diag.scoreGeral.toFixed(0)}/100` : ""}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="gap-2" onClick={() => setVista("resultado")}>
                Ver meu diagnóstico
                <ArrowRight className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2" disabled={refazer.isPending}>
                    {refazer.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Refazer
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Refazer o diagnóstico?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Suas 35 respostas, as notas por Fonte e o plano de ação gerado serão apagados.
                      Não dá para desfazer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() =>
                        refazer.mutate(undefined, {
                          onSuccess: () => {
                            toast.success("Diagnóstico reiniciado.");
                            setStepInicial(0);
                            setVista("form");
                          },
                          onError: (e: Error) => toast.error(e.message),
                        })
                      }
                    >
                      Refazer
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        ) : diag.iniciado ? (
          /* Estado 2 · em andamento */
          <div className="mt-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">
                Fonte {fonteAtual?.numero ?? 1} de {FONTES_LIST.length}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {diag.percentual}% concluído
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${diag.percentual}%` }}
              />
            </div>
            <Button
              className="mt-4 gap-2"
              onClick={() => {
                setStepInicial(diag.primeiraIncompleta);
                setVista("form");
              }}
            >
              Retomar de onde parou
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          /* Estado 1 · não iniciado */
          <div className="mt-5">
            <Button
              className="gap-2"
              onClick={() => {
                setStepInicial(0);
                setVista("form");
              }}
            >
              Começar diagnóstico
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Prévia do que será avaliado */}
      <div
        className="animate-fade-up grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        style={{ animationDelay: "150ms" }}
      >
        {FONTES_LIST.map((f) => (
          <div key={f.slug} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-secondary text-[11px] font-bold">
                {f.numero}
              </span>
              <p className="truncate text-sm font-semibold">{f.label}</p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.descricao}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
        <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 text-blue-700/70" />
        <p className="text-xs leading-relaxed text-blue-900">
          O diagnóstico é uma autoavaliação — responda pensando na operação de hoje, não na que você
          gostaria de ter. Quanto mais honesto o retrato, mais útil o plano de ação.
        </p>
      </div>
    </div>
  );
}
