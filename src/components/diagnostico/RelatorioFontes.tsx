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
import { FONTES_LIST, faixaScore, TONE_CLASS } from "@/lib/fontes";
import { cn } from "@/lib/utils";
import { exportRelatorioPdf } from "@/lib/diagnosticoPdf";

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
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          Score por Fonte
        </p>
        {temScores ? (
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="65%" margin={{ top: 8, bottom: 8 }}>
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="fonte" tick={{ fontSize: 11, fill: "#64748b" }} />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
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
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 px-4 text-center text-xs text-muted-foreground">
            {temScores
              ? "Nenhum relatório gerado ainda para este cliente."
              : "Gere o relatório depois que o cliente responder a autoavaliação."}
          </div>
        ) : (
          <div className="space-y-2 text-sm leading-relaxed text-foreground">
            <p className="whitespace-pre-line">{relatorio.resumo_executivo}</p>
            <p className="pt-1 text-[11px] text-muted-foreground">
              Gerado em {new Date(relatorio.gerado_em).toLocaleString("pt-BR")}
              {relatorio.score_geral != null ? ` · score geral ${relatorio.score_geral}/100` : ""}
            </p>
          </div>
        )}
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
                className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(15,27,53,0.04)]"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
                    {f.label}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                      TONE_CLASS[faixa.tone],
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
