import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Link2, Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/ui/kpi-card";
import { Button } from "@/components/ui/button";
import { ResultadoFontes } from "@/components/diagnostico/ResultadoFontes";
import { useDiagnosticoQuestoes } from "@/hooks/useDiagnostico7Fontes";
import { FONTES_META, TONE_CLASS, classificacao, type Fonte } from "@/lib/fontes";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/diagnosticos")({
  component: DiagnosticosPage,
  head: () => ({ meta: [{ title: "Diagnóstico 7 Fontes · Tabgha OS" }] }),
});

const PERIODOS = [
  { dias: 0, label: "Todo o período" },
  { dias: 30, label: "Últimos 30 dias" },
  { dias: 90, label: "Últimos 90 dias" },
] as const;

const FAIXAS = [
  { key: "", label: "Todas as notas" },
  { key: "iniciante", label: "Iniciante (0-25)" },
  { key: "em_desenvolvimento", label: "Em desenvolvimento (26-50)" },
  { key: "consolidado", label: "Consolidado (51-75)" },
  { key: "avancado", label: "Avançado (76-100)" },
] as const;

type Linha = {
  id: string;
  nome: string;
  especialidade: string | null;
  status: string;
  scoreGeral: number | null;
  respostasTotal: number;
  atualizadoEm: string | null;
  fonteMaisFraca: Fonte | null;
  fonteMaisFracaScore: number | null;
  relatorioEm: string | null;
  linkToken: string | null;
  linkExpiraEm: string | null;
};

function DiagnosticosPage() {
  const [aberto, setAberto] = useState<string>("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState<number>(0);
  const [filtroFaixa, setFiltroFaixa] = useState<string>("");
  const [copiado, setCopiado] = useState<string | null>(null);

  const questoes = useDiagnosticoQuestoes();
  const totalPerguntas = questoes.data?.length ?? 35;

  const { data: linhas = [], isLoading } = useQuery<Linha[]>({
    queryKey: ["admin", "diagnosticos", "linhas"],
    staleTime: 30_000,
    queryFn: async () => {
      const [{ data: clientes, error }, { data: geral }, { data: scores }, { data: relatorios }] =
        await Promise.all([
          supabase
            .from("clientes")
            .select("id, nome, especialidade, status")
            .in("status", ["ativo", "onboarding"])
            .order("nome"),
          supabase
            .from("vw_diagnostico_score_geral")
            .select("cliente_id, score_geral, respostas_total, atualizado_em"),
          supabase.from("diagnostico_scores").select("cliente_id, fonte, score"),
          supabase
            .from("diagnostico_relatorios")
            .select("cliente_id, gerado_em, link_token, link_expira_em"),
        ]);
      if (error) throw error;

      type ClienteRaw = {
        id: string;
        nome: string;
        especialidade: string | null;
        status: string;
      };
      type GeralRaw = {
        cliente_id: string | null;
        score_geral: number | null;
        respostas_total: number | null;
        atualizado_em: string | null;
      };
      type ScoreRaw = { cliente_id: string; fonte: string; score: number | null };
      type RelRaw = {
        cliente_id: string;
        gerado_em: string;
        link_token: string | null;
        link_expira_em: string | null;
      };

      const clientesRaw = (clientes ?? []) as ClienteRaw[];
      const scoresRaw = (scores ?? []) as ScoreRaw[];

      const geralMap = new Map<
        string,
        { score: number | null; respostas: number; atualizado: string | null }
      >(
        ((geral ?? []) as GeralRaw[]).map((g) => [
          g.cliente_id ?? "",
          {
            score: g.score_geral,
            respostas: g.respostas_total ?? 0,
            atualizado: g.atualizado_em,
          },
        ]),
      );
      const relMap = new Map<string, RelRaw>(
        ((relatorios ?? []) as RelRaw[]).map((r) => [r.cliente_id, r]),
      );

      return clientesRaw.map((c): Linha => {
        const g = geralMap.get(c.id);
        const meus = scoresRaw.filter((s) => s.cliente_id === c.id && s.score != null);
        const fraca = meus.length
          ? meus.reduce((min, s) => (Number(s.score) < Number(min.score) ? s : min))
          : null;
        const rel = relMap.get(c.id);
        return {
          id: c.id,
          nome: c.nome,
          especialidade: c.especialidade,
          status: c.status,
          scoreGeral: g?.score ?? null,
          respostasTotal: g?.respostas ?? 0,
          atualizadoEm: g?.atualizado ?? null,
          fonteMaisFraca: (fraca?.fonte as Fonte | undefined) ?? null,
          fonteMaisFracaScore: fraca?.score ?? null,
          relatorioEm: rel?.gerado_em ?? null,
          linkToken: rel?.link_token ?? null,
          linkExpiraEm: rel?.link_expira_em ?? null,
        };
      });
    },
  });

  const filtradas = useMemo(() => {
    const corte = filtroPeriodo
      ? new Date(Date.now() - filtroPeriodo * 86_400_000).toISOString()
      : null;
    return linhas.filter((l) => {
      if (filtroCliente && l.id !== filtroCliente) return false;
      if (corte && (!l.atualizadoEm || l.atualizadoEm < corte)) return false;
      if (filtroFaixa && classificacao(l.scoreGeral).key !== filtroFaixa) return false;
      return true;
    });
  }, [linhas, filtroCliente, filtroPeriodo, filtroFaixa]);

  const comAutoavaliacao = linhas.filter((l) => l.scoreGeral != null).length;
  const concluidos = linhas.filter((l) => l.respostasTotal >= totalPerguntas).length;

  async function copiarLink(l: Linha) {
    if (!l.linkToken) return;
    const url = `${window.location.origin}/diagnostico/${l.linkToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(l.id);
      toast.success("Link do relatório copiado.");
      setTimeout(() => setCopiado(null), 1600);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="space-y-6 px-6 py-6">
      <div>
        <span className="eyebrow-pill">Estratégia</span>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight">Diagnóstico 7 Fontes</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Autoavaliação, nota por Fonte e plano de ação por IA. Clique no cliente para abrir o radar
          e o plano.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-100/40 px-4 py-3 text-blue-700">
        <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
        <p className="text-xs leading-relaxed">
          <span className="font-semibold">100% interno.</span> O médico responde dentro do próprio
          portal, depois do onboarding — nunca pela landing pública.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label="Clientes" value={linhas.length} icon={Users} tint="blue" format="raw" />
        <KpiCard
          label="Com autoavaliação"
          value={comAutoavaliacao}
          icon={Clock}
          tint="amber"
          format="raw"
        />
        <KpiCard
          label="Concluídos"
          value={concluidos}
          icon={CheckCircle2}
          tint="green"
          format="raw"
        />
      </div>

      {/* Filtros — cliente · período · faixa de nota */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          <option value="">Todos os clientes</option>
          {linhas.map((l) => (
            <option key={l.id} value={l.id}>
              {l.nome}
            </option>
          ))}
        </select>
        <select
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(Number(e.target.value))}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {PERIODOS.map((p) => (
            <option key={p.dias} value={p.dias}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={filtroFaixa}
          onChange={(e) => setFiltroFaixa(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs"
        >
          {FAIXAS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
        {filtradas.length !== linhas.length ? (
          <span className="text-xs text-muted-foreground">
            {filtradas.length} de {linhas.length}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filtradas.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-6 w-6" />}
          title={linhas.length === 0 ? "Nenhum cliente ativo" : "Nada com esses filtros"}
          description={
            linhas.length === 0
              ? "Os clientes aparecem aqui conforme forem adicionados."
              : "Ajuste cliente, período ou faixa de nota."
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/40 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground/70">
                  {["Cliente", "Data", "Nota geral", "Fonte mais fraca", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtradas.map((l) => {
                  const c = classificacao(l.scoreGeral);
                  const concluido = l.respostasTotal >= totalPerguntas;
                  const abertoAqui = aberto === l.id;
                  const fraca = l.fonteMaisFraca ? FONTES_META[l.fonteMaisFraca] : null;
                  return (
                    <Fragment key={l.id}>
                      <tr
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-secondary/40",
                          abertoAqui && "bg-sky-50/70",
                        )}
                        onClick={() => setAberto(abertoAqui ? "" : l.id)}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium">{l.nome}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {l.especialidade ?? "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {l.atualizadoEm
                            ? new Date(l.atualizadoEm).toLocaleDateString("pt-BR")
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {l.scoreGeral != null ? (
                            <span className="flex items-center gap-2">
                              <span className="text-base font-bold tabular-nums">
                                {l.scoreGeral.toFixed(0)}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                                  TONE_CLASS[c.tone],
                                )}
                              >
                                {c.label}
                              </span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {fraca ? (
                            <span>
                              {fraca.numero}. {fraca.label}
                              <span className="ml-1 tabular-nums text-muted-foreground">
                                {l.fonteMaisFracaScore != null
                                  ? `${Number(l.fonteMaisFracaScore).toFixed(0)}`
                                  : ""}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                              l.respostasTotal === 0
                                ? "bg-secondary text-muted-foreground"
                                : concluido
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700",
                            )}
                          >
                            {l.respostasTotal === 0
                              ? "Não iniciado"
                              : concluido
                                ? "Concluído"
                                : `Rascunho ${l.respostasTotal}/${totalPerguntas}`}
                          </span>
                          {l.relatorioEm ? (
                            <span className="ml-1.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                              plano ok
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <span className="flex items-center justify-end gap-1">
                            {l.linkToken ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 gap-1 px-2 text-xs"
                                onClick={() => void copiarLink(l)}
                                title="Copiar link público do relatório"
                              >
                                {copiado === l.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Link2 className="h-3.5 w-3.5" />
                                )}
                                Link
                              </Button>
                            ) : null}
                            <ChevronDown
                              className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform",
                                abertoAqui && "rotate-180",
                              )}
                            />
                          </span>
                        </td>
                      </tr>
                      {abertoAqui ? (
                        <tr>
                          <td colSpan={6} className="bg-secondary/20 px-5 py-5">
                            <ResultadoFontes clienteId={l.id} clienteNome={l.nome} podeGerar />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
