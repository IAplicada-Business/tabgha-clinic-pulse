import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { FONTES, type Fonte } from "@/lib/fontes";

export type DiagnosticoQuestao = Tables<"diagnostico_questoes">;
export type DiagnosticoResposta = Tables<"diagnostico_respostas">;
export type DiagnosticoScore = Tables<"diagnostico_scores">;

export type FonteProgresso = {
  fonte: Fonte;
  questoes: DiagnosticoQuestao[];
  respondidas: number;
  score: number | null;
};

export function useDiagnosticoQuestoes() {
  return useQuery({
    queryKey: ["diagnostico", "questoes"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostico_questoes")
        .select("*")
        .eq("ativa", true)
        .order("fonte")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as DiagnosticoQuestao[];
    },
  });
}

export function useDiagnosticoRespostas(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ["diagnostico", "respostas", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostico_respostas")
        .select("*")
        .eq("cliente_id", clienteId!);
      if (error) throw error;
      return (data ?? []) as DiagnosticoResposta[];
    },
  });
}

export function useDiagnosticoScores(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ["diagnostico", "scores", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostico_scores")
        .select("*")
        .eq("cliente_id", clienteId!);
      if (error) throw error;
      return (data ?? []) as DiagnosticoScore[];
    },
  });
}

/**
 * Grava a resposta e deixa o trigger do banco recalcular o score da Fonte.
 * O upsert usa a constraint (cliente_id, questao_id).
 */
export function useSalvarResposta(clienteId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      questaoId: string;
      valorNum?: number | null;
      valorTexto?: string | null;
    }) => {
      if (!clienteId) throw new Error("Cliente não identificado.");
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from("diagnostico_respostas").upsert(
        {
          cliente_id: clienteId,
          questao_id: input.questaoId,
          valor_num: input.valorNum ?? null,
          valor_texto: input.valorTexto ?? null,
          respondido_por: userData.user?.id ?? null,
        },
        { onConflict: "cliente_id,questao_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["diagnostico", "respostas", clienteId] });
      void queryClient.invalidateQueries({ queryKey: ["diagnostico", "scores", clienteId] });
    },
  });
}

export function useDiagnostico7Fontes(clienteId: string | null | undefined) {
  const questoes = useDiagnosticoQuestoes();
  const respostas = useDiagnosticoRespostas(clienteId);
  const scores = useDiagnosticoScores(clienteId);

  const respostaPorQuestao = useMemo(() => {
    const map = new Map<string, DiagnosticoResposta>();
    for (const r of respostas.data ?? []) map.set(r.questao_id, r);
    return map;
  }, [respostas.data]);

  const porFonte = useMemo<FonteProgresso[]>(() => {
    const scoreMap = new Map<string, DiagnosticoScore>();
    for (const s of scores.data ?? []) scoreMap.set(s.fonte, s);

    return FONTES.map((fonte) => {
      const doFonte = (questoes.data ?? []).filter((q) => q.fonte === fonte);
      const respondidas = doFonte.filter((q) => {
        const r = respostaPorQuestao.get(q.id);
        return r?.valor_num != null || !!r?.valor_texto;
      }).length;
      return {
        fonte,
        questoes: doFonte,
        respondidas,
        score: scoreMap.get(fonte)?.score ?? null,
      };
    });
  }, [questoes.data, respostaPorQuestao, scores.data]);

  const totalQuestoes = questoes.data?.length ?? 0;
  const totalRespondidas = porFonte.reduce((acc, f) => acc + f.respondidas, 0);
  const scoresValidos = porFonte.map((f) => f.score).filter((s): s is number => s != null);
  const scoreGeral = scoresValidos.length
    ? Math.round((scoresValidos.reduce((a, b) => a + b, 0) / scoresValidos.length) * 10) / 10
    : null;

  const temPlaceholder = (questoes.data ?? []).some((q) => q.placeholder);

  return {
    isLoading: questoes.isLoading || respostas.isLoading || scores.isLoading,
    error: questoes.error ?? respostas.error ?? scores.error,
    porFonte,
    respostaPorQuestao,
    totalQuestoes,
    totalRespondidas,
    scoreGeral,
    temPlaceholder,
  };
}
