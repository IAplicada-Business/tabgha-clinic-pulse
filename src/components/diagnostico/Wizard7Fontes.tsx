import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDiagnostico7Fontes, useSalvarResposta } from "@/hooks/useDiagnostico7Fontes";
import { ESCALA_OPCOES, FONTES_LIST, type FonteMeta } from "@/lib/fontes";
import { cn } from "@/lib/utils";

const ACCENT: Record<FonteMeta["accent"], { chip: string; bar: string; ring: string }> = {
  blue: { chip: "bg-blue-50 text-blue-700", bar: "bg-blue-500", ring: "ring-blue-200" },
  violet: { chip: "bg-violet-50 text-violet-700", bar: "bg-violet-500", ring: "ring-violet-200" },
  cyan: { chip: "bg-cyan-50 text-cyan-700", bar: "bg-cyan-500", ring: "ring-cyan-200" },
  emerald: {
    chip: "bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
    ring: "ring-emerald-200",
  },
  amber: { chip: "bg-amber-50 text-amber-700", bar: "bg-amber-500", ring: "ring-amber-200" },
  rose: { chip: "bg-rose-50 text-rose-700", bar: "bg-rose-500", ring: "ring-rose-200" },
  indigo: { chip: "bg-indigo-50 text-indigo-700", bar: "bg-indigo-500", ring: "ring-indigo-200" },
};

type Props = {
  clienteId: string | null | undefined;
  /** Fonte em que o wizard abre (0-6). */
  stepInicial?: number;
  /** Sair salvando rascunho — as respostas já vão para o banco a cada clique. */
  onSair?: () => void;
  /** Disparado ao terminar a Fonte 7 com tudo respondido. */
  onConcluir?: () => void;
};

export function Wizard7Fontes({ clienteId, stepInicial = 0, onSair, onConcluir }: Props) {
  const [step, setStep] = useState(stepInicial);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const diag = useDiagnostico7Fontes(clienteId);
  const salvar = useSalvarResposta(clienteId);

  useEffect(() => {
    setStep(stepInicial);
  }, [stepInicial]);

  // Rola para o topo ao trocar de Fonte — senão o usuário cai no meio da lista.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  const meta = FONTES_LIST[step];
  const atual = diag.porFonte[step];
  const ultima = step === FONTES_LIST.length - 1;

  async function responder(questaoId: string, valor: number) {
    setSalvando(questaoId);
    try {
      await salvar.mutateAsync({ questaoId, valorNum: valor });
      setSalvoEm(new Date());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a resposta.");
    } finally {
      setSalvando(null);
    }
  }

  function avancar() {
    if (ultima) {
      onConcluir?.();
      return;
    }
    setStep((s) => s + 1);
  }

  if (diag.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!clienteId) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Seu usuário ainda não está vinculado a uma clínica. Fale com a equipe Tabgha.
      </p>
    );
  }

  if (diag.totalQuestoes === 0 || !meta || !atual) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        O questionário ainda não foi publicado.
      </p>
    );
  }

  return (
    <div className="pb-24">
      {/* ── Header fixo: progresso + sair ── */}
      <div className="sticky top-0 z-20 -mx-6 border-b border-border bg-background/95 px-6 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Fonte {meta.numero} de {FONTES_LIST.length}
            </p>
            <p className="truncate text-sm font-semibold">{meta.label}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
              {diag.totalRespondidas}/{diag.totalQuestoes} · {diag.percentual}%
            </span>
            {onSair ? (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={onSair}>
                <X className="h-4 w-4" />
                Sair
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 flex gap-1.5">
          {FONTES_LIST.map((f, i) => {
            const p = diag.porFonte[i];
            return (
              <button
                key={f.slug}
                type="button"
                onClick={() => setStep(i)}
                title={`${f.numero}. ${f.label}`}
                aria-label={`Ir para Fonte ${f.numero}: ${f.label}`}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-opacity",
                  p?.completa ? ACCENT[f.accent].bar : "bg-muted",
                  step === i ? "opacity-100 ring-2 ring-offset-2" : "opacity-70 hover:opacity-100",
                  step === i && ACCENT[f.accent].ring,
                )}
              />
            );
          })}
        </div>
      </div>

      {/* ── Título da Fonte ── */}
      <div className="pt-6">
        <span
          className={cn(
            "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
            ACCENT[meta.accent].chip,
          )}
        >
          Fonte {meta.numero}
        </span>
        <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{meta.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{meta.descricao}</p>
      </div>

      {/* ── 5 cards de pergunta ── */}
      <div className="mt-5 space-y-3">
        {atual.questoes.map((q, i) => {
          const resposta = diag.respostaPorQuestao.get(q.id);
          const salvandoEsta = salvando === q.id;
          return (
            <div
              key={q.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]"
            >
              <div className="flex items-start gap-3">
                <span className="mt-0.5 text-[11px] font-black tabular-nums text-muted-foreground/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="flex-1 text-[15px] font-medium leading-relaxed">{q.pergunta}</p>
              </div>

              <fieldset className="mt-4">
                <legend className="sr-only">{q.pergunta}</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {ESCALA_OPCOES.map((op) => {
                    const ativo = resposta?.valor_num === op.valor;
                    return (
                      <button
                        key={op.valor}
                        type="button"
                        role="radio"
                        aria-checked={ativo}
                        disabled={salvandoEsta}
                        onClick={() => void responder(q.id, op.valor)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-colors",
                          ativo
                            ? "border-primary bg-primary/10 font-semibold text-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted/60",
                          salvandoEsta && "opacity-60",
                        )}
                      >
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full border",
                            ativo ? "border-primary bg-primary" : "border-muted-foreground/30",
                          )}
                        />
                        <span className="text-[11px] leading-tight">{op.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          );
        })}
      </div>

      {/* ── Rodapé fixo: anterior · auto-save · próxima ── */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="h-4 w-4" />
            Anterior
          </Button>

          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {salvando ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                salvando…
              </>
            ) : salvoEm ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="hidden sm:inline">respostas salvas automaticamente</span>
                <span className="sm:hidden">salvo</span>
              </>
            ) : (
              <span className="tabular-nums">
                {atual.respondidas}/{atual.questoes.length} nesta Fonte
              </span>
            )}
          </span>

          <Button size="sm" className="gap-2" disabled={!atual.completa} onClick={avancar}>
            {ultima ? "Ver meu diagnóstico" : "Próxima Fonte"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
