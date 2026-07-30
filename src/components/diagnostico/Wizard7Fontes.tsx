import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useDiagnostico7Fontes, useSalvarResposta } from "@/hooks/useDiagnostico7Fontes";
import { ESCALA_LABELS, FONTES_LIST, TONE_CLASS, faixaScore, type FonteMeta } from "@/lib/fontes";
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

export function Wizard7Fontes({ clienteId }: { clienteId: string | null | undefined }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState<string | null>(null);
  const diag = useDiagnostico7Fontes(clienteId);
  const salvar = useSalvarResposta(clienteId);

  const isResumo = step >= FONTES_LIST.length;
  const meta = isResumo ? null : FONTES_LIST[step];
  const atual = isResumo ? null : diag.porFonte[step];

  async function responder(questaoId: string, valor: number) {
    setSaving(questaoId);
    try {
      await salvar.mutateAsync({ questaoId, valorNum: valor });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a resposta.");
    } finally {
      setSaving(null);
    }
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

  if (diag.totalQuestoes === 0) {
    return (
      <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        O questionário ainda não foi publicado.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {diag.temPlaceholder ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-5 py-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="text-xs leading-relaxed text-amber-900">
            <p className="font-semibold">Questionário provisório</p>
            <p className="mt-0.5">
              As perguntas e a régua de pontuação abaixo são uma versão de trabalho para validar o
              fluxo. O questionário oficial das 7 Fontes ainda está em elaboração e vai substituir
              este conteúdo — as respostas já dadas ficam preservadas.
            </p>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Progresso
            </p>
            <p className="mt-0.5 text-sm font-semibold">
              {diag.totalRespondidas} de {diag.totalQuestoes} perguntas respondidas
            </p>
          </div>
          {diag.scoreGeral != null ? (
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Score geral
              </p>
              <p className="text-lg font-bold tabular-nums">{diag.scoreGeral}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex gap-1.5">
          {FONTES_LIST.map((f, i) => {
            const p = diag.porFonte[i];
            const completa = p.questoes.length > 0 && p.respondidas === p.questoes.length;
            return (
              <button
                key={f.slug}
                type="button"
                onClick={() => setStep(i)}
                title={f.label}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-opacity",
                  completa ? ACCENT[f.accent].bar : "bg-muted",
                  step === i ? "opacity-100 ring-2 ring-offset-2" : "opacity-70 hover:opacity-100",
                  step === i && ACCENT[f.accent].ring,
                )}
              />
            );
          })}
        </div>
      </div>

      {isResumo ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Resumo
          </p>
          <h3 className="mt-1 text-base font-semibold">Score por Fonte</h3>
          <div className="mt-4 space-y-3">
            {FONTES_LIST.map((f, i) => {
              const p = diag.porFonte[i];
              const faixa = faixaScore(p.score);
              return (
                <div key={f.slug} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">
                      {f.numero}. {f.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                          TONE_CLASS[faixa.tone],
                        )}
                      >
                        {faixa.label}
                      </span>
                      <span className="w-10 text-right tabular-nums text-muted-foreground">
                        {p.score != null ? p.score : "—"}
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all", ACCENT[f.accent].bar)}
                      style={{ width: `${p.score ?? 0}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Button variant="outline" className="mt-5 gap-2" onClick={() => setStep(0)}>
            <ArrowLeft className="h-4 w-4" />
            Revisar respostas
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <span
              className={cn(
                "inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
                ACCENT[meta!.accent].chip,
              )}
            >
              Fonte {meta!.numero} de {FONTES_LIST.length}
            </span>
            <h3 className="mt-2 text-base font-semibold">{meta!.label}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{meta!.descricao}</p>
          </div>

          <div className="divide-y divide-border">
            {atual!.questoes.map((q) => {
              const resposta = diag.respostaPorQuestao.get(q.id);
              return (
                <div key={q.id} className="px-5 py-4">
                  <p className="text-sm leading-relaxed">{q.pergunta}</p>
                  {q.ajuda ? <p className="mt-1 text-xs text-muted-foreground">{q.ajuda}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((v) => {
                      const ativo = resposta?.valor_num === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={saving === q.id}
                          onClick={() => void responder(q.id, v)}
                          className={cn(
                            "flex min-w-[92px] flex-col items-center gap-0.5 rounded-xl border px-3 py-2 text-xs transition-colors",
                            ativo
                              ? "border-primary bg-primary/10 font-semibold text-primary"
                              : "border-border hover:border-primary/40 hover:bg-muted/60",
                            saving === q.id && "opacity-60",
                          )}
                        >
                          <span className="text-sm font-bold tabular-nums">{v}</span>
                          <span className="text-[10px] leading-none text-muted-foreground">
                            {ESCALA_LABELS[v]}
                          </span>
                        </button>
                      );
                    })}
                    {saving === q.id ? (
                      <span className="flex items-center text-xs text-muted-foreground">
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        salvando
                      </span>
                    ) : resposta?.valor_num != null ? (
                      <span className="flex items-center text-xs text-emerald-600">
                        <Check className="mr-1 h-3.5 w-3.5" />
                        salvo
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-4">
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
            <span className="text-xs text-muted-foreground">
              {atual!.respondidas}/{atual!.questoes.length} nesta Fonte
            </span>
            <Button size="sm" className="gap-2" onClick={() => setStep((s) => s + 1)}>
              {step === FONTES_LIST.length - 1 ? "Ver resumo" : "Próxima Fonte"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
