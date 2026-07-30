import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2, Stethoscope } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { RelatorioFontes } from "@/components/diagnostico/RelatorioFontes";
import { faixaScore } from "@/lib/fontes";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/diagnosticos")({
  component: DiagnosticosPage,
  head: () => ({ meta: [{ title: "Diagnósticos — Tabgha Admin" }] }),
});

const TONE_CHIP: Record<ReturnType<typeof faixaScore>["tone"], string> = {
  critico: "bg-rose-50 text-rose-700",
  atencao: "bg-amber-50 text-amber-700",
  bom: "bg-blue-50 text-blue-700",
  forte: "bg-emerald-50 text-emerald-700",
};

function DiagnosticosPage() {
  const [clienteId, setClienteId] = useState<string>("");

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["admin", "diagnosticos", "clientes"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, especialidade, status")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: scoresGerais = [] } = useQuery({
    queryKey: ["admin", "diagnosticos", "score-geral"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vw_diagnostico_score_geral")
        .select("cliente_id, score_geral, fontes_com_resposta");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: relatorios = [] } = useQuery({
    queryKey: ["admin", "diagnosticos", "relatorios"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostico_relatorios")
        .select("cliente_id, gerado_em");
      if (error) throw error;
      return data ?? [];
    },
  });

  const scoreMap = useMemo(() => {
    const map = new Map<string, { score: number | null; fontes: number }>();
    for (const s of scoresGerais) {
      map.set(s.cliente_id!, { score: s.score_geral, fontes: s.fontes_com_resposta ?? 0 });
    }
    return map;
  }, [scoresGerais]);

  const relatorioMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of relatorios) map.set(r.cliente_id, r.gerado_em);
    return map;
  }, [relatorios]);

  const comAutoavaliacao = clientes.filter((c) => scoreMap.get(c.id)?.score != null);
  const comRelatorio = clientes.filter((c) => relatorioMap.has(c.id));

  const clienteSelecionado = clientes.find((c) => c.id === clienteId);

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Diagnósticos · 7 Fontes</h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Autoavaliação, score por Fonte e relatório executivo gerado por IA. Clique em um cliente
          para abrir o radar e o relatório.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-100/40 px-4 py-3 text-blue-700">
        <Stethoscope className="mt-0.5 h-4 w-4 shrink-0 opacity-70" />
        <p className="text-xs leading-relaxed">
          <span className="font-semibold">100% interno.</span> Clientes acessam a autoavaliação
          somente dentro do próprio portal, depois do onboarding — nunca pela landing pública.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          {
            label: "Total",
            value: clientes.length,
            color: "text-foreground",
            bg: "bg-secondary/60",
          },
          {
            label: "Com autoavaliação",
            value: comAutoavaliacao.length,
            color: "text-blue-700",
            bg: "bg-blue-50 border-blue-100",
          },
          {
            label: "Com relatório gerado",
            value: comRelatorio.length,
            color: "text-emerald-700",
            bg: "bg-emerald-50 border-emerald-100",
          },
        ].map(({ label, value, color, bg }, i) => (
          <div
            key={label}
            className="card-lift animate-fade-up rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]"
            style={{ animationDelay: `${i * 75}ms` }}
          >
            <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
              {label}
            </p>
            <div className="mt-2 flex items-end justify-between">
              <p
                className={`text-3xl font-extrabold tracking-tight animate-numeric-pop ${color}`}
                style={{ animationDelay: `${i * 75 + 120}ms` }}
              >
                {value}
              </p>
              <div className={`rounded-xl px-2.5 py-1 text-[11px] font-bold ${color} ${bg}`}>
                {clientes.length > 0 ? `${Math.round((value / clientes.length) * 100)}%` : "—"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : clientes.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-6 w-6" />}
          title="Nenhum cliente cadastrado"
          description="Os clientes aparecem aqui conforme forem adicionados."
        />
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border">
          {clientes.map((c) => {
            const info = scoreMap.get(c.id);
            const faixa = faixaScore(info?.score ?? null);
            const aberto = clienteId === c.id;
            return (
              <div key={c.id}>
                <button
                  type="button"
                  onClick={() => setClienteId(aberto ? "" : c.id)}
                  className={cn(
                    "flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-muted/40",
                    aberto && "bg-sky-50/70 hover:bg-sky-50",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.especialidade ?? "—"} · {c.status}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        TONE_CHIP[faixa.tone],
                      )}
                    >
                      {info?.score != null
                        ? `${info.score}/100 · ${faixa.label}`
                        : "Sem autoavaliação"}
                    </span>
                    {relatorioMap.has(c.id) ? (
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        Relatório ok
                      </span>
                    ) : null}
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-muted-foreground transition-transform",
                        aberto && "rotate-180",
                      )}
                    />
                  </div>
                </button>
                {aberto ? (
                  <div className="border-t border-border bg-secondary/20 px-5 py-5">
                    <RelatorioFontes
                      clienteId={c.id}
                      clienteNome={clienteSelecionado?.nome ?? c.nome}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
