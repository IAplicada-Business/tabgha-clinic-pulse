import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { FONTES, faixaFrase, scoreGeral, type Fonte } from "@/lib/fontes";

export type DiagnosticoQuestao = Tables<"diagnostico_questoes">;
export type DiagnosticoResposta = Tables<"diagnostico_respostas">;
export type DiagnosticoScore = Tables<"diagnostico_scores">;
export type DiagnosticoFrase = Tables<"diagnostico_frases_por_faixa">;

export type FonteProgresso = {
  fonte: Fonte;
  questoes: DiagnosticoQuestao[];
  respondidas: number;
  score: number | null;
  completa: boolean;
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

export function useDiagnosticoFrases() {
  return useQuery({
    queryKey: ["diagnostico", "frases"],
    staleTime: 300_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostico_frases_por_faixa")
        .select("*")
        .order("fonte")
        .order("faixa_min");
      if (error) throw error;
      return (data ?? []) as DiagnosticoFrase[];
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

/** Refazer o diagnóstico: apaga respostas (o trigger zera os scores) e o relatório. */
export function useRefazerDiagnostico(clienteId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Cliente não identificado.");
      const { error } = await supabase
        .from("diagnostico_respostas")
        .delete()
        .eq("cliente_id", clienteId);
      if (error) throw error;

      const { error: scoreErr } = await supabase
        .from("diagnostico_scores")
        .delete()
        .eq("cliente_id", clienteId);
      if (scoreErr) throw scoreErr;

      const { error: relErr } = await supabase
        .from("diagnostico_relatorios")
        .delete()
        .eq("cliente_id", clienteId);
      if (relErr) throw relErr;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["diagnostico"] });
    },
  });
}

export function useDiagnostico7Fontes(clienteId: string | null | undefined) {
  const questoes = useDiagnosticoQuestoes();
  const respostas = useDiagnosticoRespostas(clienteId);
  const scores = useDiagnosticoScores(clienteId);
  const frases = useDiagnosticoFrases();

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
        completa: doFonte.length > 0 && respondidas === doFonte.length,
      };
    });
  }, [questoes.data, respostaPorQuestao, scores.data]);

  /** Frase diagnóstica da Fonte conforme a faixa do score. */
  const fraseDaFonte = useMemo(() => {
    const map = new Map<string, DiagnosticoFrase>();
    for (const f of frases.data ?? []) map.set(`${f.fonte}:${f.faixa_min}`, f);
    return (fonte: Fonte, score: number | null | undefined) => {
      const faixa = faixaFrase(score);
      if (faixa == null) return null;
      return map.get(`${fonte}:${faixa}`) ?? null;
    };
  }, [frases.data]);

  const totalQuestoes = questoes.data?.length ?? 0;
  const totalRespondidas = porFonte.reduce((acc, f) => acc + f.respondidas, 0);
  const geral = scoreGeral(porFonte.map((f) => f.score));

  const percentual = totalQuestoes > 0 ? Math.round((totalRespondidas / totalQuestoes) * 100) : 0;
  const concluido = totalQuestoes > 0 && totalRespondidas === totalQuestoes;
  const iniciado = totalRespondidas > 0;
  /** Índice da primeira Fonte incompleta — é onde o "retomar" deve cair. */
  const primeiraIncompleta = Math.max(
    0,
    porFonte.findIndex((f) => !f.completa),
  );

  const concluidoEm = useMemo(() => {
    if (!concluido) return null;
    const datas = (respostas.data ?? []).map((r) => r.atualizado_em).filter(Boolean);
    return datas.length ? datas.sort().at(-1)! : null;
  }, [concluido, respostas.data]);

  const temPlaceholder = (questoes.data ?? []).some((q) => q.placeholder);

  return {
    isLoading: questoes.isLoading || respostas.isLoading || scores.isLoading || frases.isLoading,
    error: questoes.error ?? respostas.error ?? scores.error ?? frases.error,
    porFonte,
    respostaPorQuestao,
    fraseDaFonte,
    totalQuestoes,
    totalRespondidas,
    percentual,
    concluido,
    iniciado,
    primeiraIncompleta,
    concluidoEm,
    scoreGeral: geral,
    temPlaceholder,
  };
}
