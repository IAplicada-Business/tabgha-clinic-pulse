import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Download, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CHART_TOOLTIP_STYLE } from "@/components/analytics/InsightPanel";
import { useDiagnosticoScores } from "@/hooks/useDiagnostico7Fontes";
import {
  useDiagnosticoRelatorio,
  useGerarDiagnosticoRelatorio,
} from "@/hooks/useDiagnosticoRelatorio";
import { FONTES_LIST, faixaScore, type FonteMeta } from "@/lib/fontes";
import { cn } from "@/lib/utils";
import { exportRelatorioPdf } from "@/lib/diagnosticoPdf";

const ACCENT: Record<FonteMeta["accent"], { chip: string; border: string }> = {
  blue: { chip: "bg-blue-50 text-blue-700", border: "border-blue-100" },
  violet: { chip: "bg-violet-50 text-violet-700", border: "border-violet-100" },
  cyan: { chip: "bg-cyan-50 text-cyan-700", border: "border-cyan-100" },
  emerald: { chip: "bg-emerald-50 text-emerald-700", border: "border-emerald-100" },
  amber: { chip: "bg-amber-50 text-amber-700", border: "border-amber-100" },
  rose: { chip: "bg-rose-50 text-rose-700", border: "border-rose-100" },
  indigo: { chip: "bg-indigo-50 text-indigo-700", border: "border-indigo-100" },
};

const TONE_CHIP: Record<ReturnType<typeof faixaScore>["tone"], string> = {
  critico: "bg-rose-50 text-rose-700",
  atencao: "bg-amber-50 text-amber-700",
  bom: "bg-blue-50 text-blue-700",
  forte: "bg-emerald-50 text-emerald-700",
};

export function RelatorioFontes({
  clienteId,
  clienteNome,
}: {
  clienteId: string;
  clienteNome: string;
}) {
  const scoresQuery = useDiagnosticoScores(clienteId);
  const relatorioQuery = useDiagnosticoRelatorio(clienteId);
  const gerarMutation = useGerarDiagnosticoRelatorio(clienteId);

  const scoreMap = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const s of scoresQuery.data ?? []) map.set(s.fonte, s.score);
    return map;
  }, [scoresQuery.data]);

  const radarData = FONTES_LIST.map((f) => ({
    fonte: f.label,
    score: scoreMap.get(f.slug) ?? 0,
  }));

  const temScores = (scoresQuery.data?.length ?? 0) > 0;
  const relatorio = relatorioQuery.data;
  const porFonte = (relatorio?.por_fonte ?? {}) as Record<
    string,
    { diagnostico?: string; oportunidades?: string[]; plano_acao?: string[] }
  >;

  async function gerar() {
    try {
      await gerarMutation.mutateAsync();
      toast.success("Relatório gerado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar o relatório.");
    }
  }

  function exportarPdf() {
    if (!relatorio) return;
    try {
      exportRelatorioPdf({
        clienteNome,
        relatorio,
        scores: FONTES_LIST.map((f) => ({ label: f.label, score: scoreMap.get(f.slug) ?? null })),
      });
    } catch {
      toast.error("Não foi possível exportar o PDF.");
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
            Score por Fonte
          </p>
          {temScores ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="fonte" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <Radar dataKey="score" stroke="#0284c7" fill="#0284c7" fillOpacity={0.35} />
                  <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-72 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 px-4 text-center text-xs text-muted-foreground">
              Cliente ainda não respondeu a autoavaliação das 7 Fontes.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Relatório executivo
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={!relatorio}
                onClick={exportarPdf}
                className="gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                PDF
              </Button>
              <Button
                size="sm"
                disabled={!temScores || gerarMutation.isPending}
                onClick={() => void gerar()}
                className="gap-1.5 bg-sky-600 hover:bg-sky-700"
              >
                {gerarMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : relatorio ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {relatorio ? "Atualizar" : "Gerar relatório"}
              </Button>
            </div>
          </div>

          {!relatorio ? (
            <div className="flex h-56 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 px-4 text-center text-xs text-muted-foreground">
              {temScores
                ? "Nenhum relatório gerado ainda para este cliente."
                : "Gere o relatório depois que o cliente responder a autoavaliação."}
            </div>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground">
              <p className="whitespace-pre-line">{relatorio.resumo_executivo}</p>
              <p className="pt-1 text-[11px] text-muted-foreground">
                Gerado em {new Date(relatorio.gerado_em).toLocaleString("pt-BR")}
                {relatorio.score_geral != null ? ` · score geral ${relatorio.score_geral}/100` : ""}
              </p>
            </div>
          )}
        </div>
      </div>

      {relatorio ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FONTES_LIST.map((f) => {
            const dado = porFonte[f.slug];
            const score = scoreMap.get(f.slug) ?? null;
            const faixa = faixaScore(score);
            return (
              <div
                key={f.slug}
                className={cn(
                  "rounded-2xl border bg-card p-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)]",
                  ACCENT[f.accent].border,
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      ACCENT[f.accent].chip,
                    )}
                  >
                    {f.label}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                      TONE_CHIP[faixa.tone],
                    )}
                  >
                    {score != null ? `${score}/100 · ${faixa.label}` : faixa.label}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-foreground">
                  {dado?.diagnostico || "Sem diagnóstico gerado."}
                </p>
                {dado?.oportunidades?.length ? (
                  <div className="mt-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                      Oportunidades
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-foreground">
                      {dado.oportunidades.map((o, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-muted-foreground">•</span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {dado?.plano_acao?.length ? (
                  <div className="mt-3">
                    <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground">
                      Plano de ação
                    </p>
                    <ul className="mt-1 space-y-1 text-xs text-foreground">
                      {dado.plano_acao.map((o, i) => (
                        <li key={i} className="flex gap-1.5">
                          <span className="text-muted-foreground">{i + 1}.</span>
                          <span>{o}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
