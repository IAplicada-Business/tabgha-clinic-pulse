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
import { CalendarPlus, Download, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CHART_TOOLTIP_STYLE } from "@/components/analytics/InsightPanel";
import { useDiagnostico7Fontes } from "@/hooks/useDiagnostico7Fontes";
import {
  useDiagnosticoRelatorio,
  useGerarDiagnosticoRelatorio,
} from "@/hooks/useDiagnosticoRelatorio";
import { FONTES_LIST, TONE_CLASS, TONE_SOLID, classificacao } from "@/lib/fontes";
import { exportRelatorioPdf } from "@/lib/diagnosticoPdf";
import { cn } from "@/lib/utils";

/** Série única (uma clínica) — uma cor só, sem legenda: o título já a nomeia. */
const RADAR_COLOR = "#1A5FAD";

type Props = {
  clienteId: string;
  clienteNome: string;
  /** Admin vê os botões de gerar/atualizar relatório e exportar PDF. */
  podeGerar?: boolean;
  /** Link do calendário para a sessão de aprofundamento (portal do cliente). */
  urlAgendamento?: string | null;
};

export function ResultadoFontes({
  clienteId,
  clienteNome,
  podeGerar = false,
  urlAgendamento,
}: Props) {
  const diag = useDiagnostico7Fontes(clienteId);
  const relatorioQuery = useDiagnosticoRelatorio(clienteId);
  const gerarMutation = useGerarDiagnosticoRelatorio(clienteId);

  const scorePorFonte = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const p of diag.porFonte) map.set(p.fonte, p.score);
    return map;
  }, [diag.porFonte]);

  const radarData = FONTES_LIST.map((f) => ({
    fonte: f.label,
    score: scorePorFonte.get(f.slug) ?? 0,
  }));

  const geral = diag.scoreGeral;
  const classe = classificacao(geral);
  const temScores = diag.porFonte.some((p) => p.score != null);

  const relatorio = relatorioQuery.data;
  /** As 3 Fontes mais fracas que a IA priorizou. Formatos antigos (plano_acao) ainda leem. */
  const porFonteRelatorio = (relatorio?.por_fonte ?? {}) as Record<
    string,
    {
      diagnostico?: string;
      acao_30_dias?: string;
      ferramenta_tabgha?: string;
      oportunidades?: string[];
      plano_acao?: string[];
    }
  >;

  /** Ordem das prioridades = da Fonte mais fraca para a menos fraca. */
  const prioridades = useMemo(
    () =>
      FONTES_LIST.filter((f) => porFonteRelatorio[f.slug]?.acao_30_dias)
        .map((f) => ({ fonte: f, dados: porFonteRelatorio[f.slug]! }))
        .sort(
          (a, b) => (scorePorFonte.get(a.fonte.slug) ?? 0) - (scorePorFonte.get(b.fonte.slug) ?? 0),
        ),
    [porFonteRelatorio, scorePorFonte],
  );

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
        scores: FONTES_LIST.map((f) => ({
          label: f.label,
          score: scorePorFonte.get(f.slug) ?? null,
        })),
      });
    } catch {
      toast.error("Não foi possível exportar o PDF.");
    }
  }

  if (diag.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!temScores) {
    return (
      <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/30 px-6 text-center text-sm text-muted-foreground">
        A autoavaliação das 7 Fontes ainda não foi respondida.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Nota geral + classificação ── */}
      <div className="rounded-2xl border border-border bg-card px-6 py-7 text-center shadow-[var(--shadow-card)]">
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          Nota geral
        </p>
        <p className="mt-1 animate-numeric-pop text-6xl font-black tracking-tight tabular-nums sm:text-7xl">
          {geral != null ? geral.toFixed(0) : "—"}
          <span className="text-2xl font-bold text-muted-foreground/50">/100</span>
        </p>
        <span
          className={cn(
            "mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide",
            TONE_CLASS[classe.tone],
          )}
        >
          {classe.label}
        </span>
        {!diag.concluido ? (
          <p className="mt-2 text-[11px] text-amber-700">
            Parcial — {diag.totalRespondidas} de {diag.totalQuestoes} perguntas respondidas.
          </p>
        ) : null}
      </div>

      {/* ── Radar: série única, sem legenda (o título nomeia a série) ── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="mb-1 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          Maturidade por Fonte · {clienteNome}
        </p>
        <div className="h-80 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="68%" margin={{ top: 12, bottom: 12 }}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="fonte" tick={{ fontSize: 11, fill: "#64748b" }} />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tickCount={5}
                tick={{ fontSize: 10, fill: "#94a3b8" }}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke={RADAR_COLOR}
                strokeWidth={2}
                fill={RADAR_COLOR}
                fillOpacity={0.28}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(v: number | string) => [`${v}/100`, "Score"]}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── 7 cards: nota + classificação + frase da faixa ── */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {FONTES_LIST.map((f) => {
          const score = scorePorFonte.get(f.slug) ?? null;
          const c = classificacao(score);
          const frase = diag.fraseDaFonte(f.slug, score);
          const doRelatorio = porFonteRelatorio[f.slug];
          return (
            <div
              key={f.slug}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-xs)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Fonte {f.numero}
                  </p>
                  <p className="mt-0.5 truncate text-sm font-semibold">{f.label}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-2xl font-extrabold tabular-nums leading-none">
                    {score != null ? score.toFixed(0) : "—"}
                  </p>
                  <span
                    className={cn(
                      "mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      TONE_CLASS[c.tone],
                    )}
                  >
                    {c.label}
                  </span>
                </div>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", TONE_SOLID[c.tone])}
                  style={{ width: `${score ?? 0}%` }}
                />
              </div>

              {frase ? (
                <p className="mt-3 text-xs leading-relaxed text-foreground">{frase.frase}</p>
              ) : null}

              {doRelatorio?.acao_30_dias || doRelatorio?.plano_acao?.length ? (
                <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">Prioridade: </span>
                  {doRelatorio.acao_30_dias ?? doRelatorio.plano_acao?.[0]}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* ── Plano de ação (IA) ── */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
            Seu plano de ação
          </p>
          {podeGerar ? (
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
                disabled={gerarMutation.isPending}
                onClick={() => void gerar()}
                className="gap-1.5"
              >
                {gerarMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : relatorio ? (
                  <RefreshCw className="h-3.5 w-3.5" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {relatorio ? "Atualizar" : "Gerar plano"}
              </Button>
            </div>
          ) : null}
        </div>

        {!relatorio ? (
          <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border bg-secondary/30 px-4 text-center text-xs text-muted-foreground">
            {podeGerar
              ? "Nenhum plano gerado ainda para este cliente."
              : "A equipe Tabgha está preparando seu plano de ação."}
          </div>
        ) : (
          <>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {relatorio.resumo_executivo}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Gerado em {new Date(relatorio.gerado_em).toLocaleString("pt-BR")}
              {relatorio.score_geral != null ? ` · score geral ${relatorio.score_geral}/100` : ""}
            </p>
          </>
        )}

        {prioridades.length ? (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {prioridades.map(({ fonte, dados }, i) => (
              <div key={fonte.slug} className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
                    {i + 1}
                  </span>
                  <p className="truncate text-xs font-bold">{fonte.label}</p>
                </div>
                {dados.diagnostico ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                    {dados.diagnostico}
                  </p>
                ) : null}
                {dados.acao_30_dias ? (
                  <div className="mt-2.5">
                    <p className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                      Próximos 30 dias
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed">{dados.acao_30_dias}</p>
                  </div>
                ) : null}
                {dados.ferramenta_tabgha ? (
                  <div className="mt-2.5">
                    <p className="text-[9.5px] font-bold uppercase tracking-wide text-muted-foreground">
                      Tabgha OS
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed">{dados.ferramenta_tabgha}</p>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {urlAgendamento ? (
          <Button asChild className="mt-4 w-full gap-2 sm:w-auto">
            <a href={urlAgendamento} target="_blank" rel="noreferrer">
              <CalendarPlus className="h-4 w-4" />
              Agendar sessão de aprofundamento
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
