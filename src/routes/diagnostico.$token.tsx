import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { FONTES_META, FONTES_LIST, TONE_CLASS, classificacao, type Fonte } from "@/lib/fontes";
import { cn } from "@/lib/utils";

/**
 * Leitura pública (sem login) do relatório, via link com token.
 * Os dados vêm da edge function diagnostico-publico, que usa service_role e
 * devolve só o necessário — a RLS das tabelas continua staff-only.
 */
export const Route = createFileRoute("/diagnostico/$token")({
  component: DiagnosticoPublicoPage,
  head: () => ({ meta: [{ title: "Diagnóstico Estratégico · Tabgha OS" }] }),
});

const RADAR_COLOR = "#1A5FAD";

type RelatorioPublico = {
  cliente_nome: string;
  especialidade: string | null;
  resumo_executivo: string | null;
  por_fonte: Record<
    string,
    { diagnostico?: string; acao_30_dias?: string; ferramenta_tabgha?: string }
  > | null;
  score_geral: number | null;
  gerado_em: string;
  scores: Array<{ fonte: string; score: number | null }>;
};

function DiagnosticoPublicoPage() {
  const { token } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["diagnostico-publico", token],
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("diagnostico-publico", {
        body: { token },
      });
      const payload = data as { ok?: boolean; error?: string; relatorio?: RelatorioPublico } | null;
      if (error || !payload?.ok || !payload.relatorio) {
        throw new Error(payload?.error ?? "Não foi possível abrir este relatório.");
      }
      return payload.relatorio;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    const msg = error instanceof Error ? error.message : "";
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center">
          <h1 className="text-lg font-bold">Relatório indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {msg === "expired"
              ? "Este link expirou. Peça um novo para a equipe Tabgha."
              : msg === "not_found"
                ? "Este link não corresponde a nenhum relatório."
                : "Não foi possível abrir este relatório."}
          </p>
        </div>
      </div>
    );
  }

  const scoreMap = new Map(data.scores.map((s) => [s.fonte, s.score]));
  const radarData = FONTES_LIST.map((f) => ({
    fonte: f.label,
    score: Number(scoreMap.get(f.slug) ?? 0),
  }));
  const classe = classificacao(data.score_geral);
  const porFonte = data.por_fonte ?? {};

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="text-center">
          <span className="eyebrow-pill">Método 7 Fontes™</span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Diagnóstico Estratégico</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.cliente_nome}
            {data.especialidade ? ` · ${data.especialidade}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gerado em {new Date(data.gerado_em).toLocaleDateString("pt-BR")}
          </p>
        </header>

        <div className="rounded-2xl border border-border bg-card px-6 py-7 text-center">
          <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
            Nota geral
          </p>
          <p className="mt-1 text-6xl font-black tracking-tight tabular-nums">
            {data.score_geral != null ? Number(data.score_geral).toFixed(0) : "—"}
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
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="mb-1 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
            Maturidade por Fonte
          </p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="68%">
                <PolarGrid stroke="var(--border)" />
                <PolarAngleAxis dataKey="fonte" tick={{ fontSize: 11, fill: "#64748b" }} />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tickCount={5}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <Radar
                  dataKey="score"
                  stroke={RADAR_COLOR}
                  strokeWidth={2}
                  fill={RADAR_COLOR}
                  fillOpacity={0.28}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FONTES_LIST.map((f) => {
            const score = scoreMap.get(f.slug);
            const c = classificacao(score != null ? Number(score) : null);
            return (
              <div key={f.slug} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">
                    {f.numero}. {f.label}
                  </p>
                  <div className="shrink-0 text-right">
                    <p className="text-xl font-extrabold tabular-nums leading-none">
                      {score != null ? Number(score).toFixed(0) : "—"}
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
                {porFonte[f.slug]?.diagnostico ? (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {porFonte[f.slug]!.diagnostico}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        {data.resumo_executivo ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Plano de ação
            </p>
            <p className="whitespace-pre-line text-sm leading-relaxed">{data.resumo_executivo}</p>

            {Object.keys(porFonte).length ? (
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {Object.entries(porFonte)
                  .filter(([, v]) => v?.acao_30_dias)
                  .map(([slug, v], i) => {
                    const meta = FONTES_META[slug as Fonte];
                    if (!meta) return null;
                    return (
                      <div
                        key={slug}
                        className="rounded-xl border border-border bg-secondary/30 p-4"
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-primary-foreground">
                            {i + 1}
                          </span>
                          <p className="truncate text-xs font-bold">{meta.label}</p>
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed">{v.acao_30_dias}</p>
                        {v.ferramenta_tabgha ? (
                          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                            <span className="font-semibold">Tabgha OS: </span>
                            {v.ferramenta_tabgha}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
              </div>
            ) : null}
          </div>
        ) : null}

        <p className="pb-6 text-center text-[11px] text-muted-foreground">
          Tabgha Health Marketing · Método 7 Fontes™
        </p>
      </div>
    </div>
  );
}
