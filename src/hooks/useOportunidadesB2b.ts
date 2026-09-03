import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { PipelineB2bStatus } from "@/lib/pipeline-b2b";

export type OportunidadeB2b = Tables<"oportunidades_b2b">;

export type OportunidadeB2bFilters = {
  periodoDias?: number | null;
  canal?: string | null;
  search?: string;
};

export type KpisPipelineB2b = {
  total_oportunidades: number;
  fechados: number;
  em_andamento: number;
  taxa_fechamento_pct: number | null;
  mrr: number;
  ticket_medio_b2b: number | null;
};

export function useOportunidadesB2b(filters: OportunidadeB2bFilters) {
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["oportunidades-b2b", filters] as const, [filters]);

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      let request = supabase
        .from("oportunidades_b2b")
        .select("*")
        .order("atualizado_em", { ascending: false });

      if (filters.canal) {
        request = request.eq("canal", filters.canal);
      }

      if (filters.periodoDias) {
        const since = new Date();
        since.setDate(since.getDate() - filters.periodoDias);
        request = request.gte("criado_em", since.toISOString());
      }

      if (filters.search?.trim()) {
        const term = filters.search.trim();
        request = request.or(
          `nome.ilike.%${term}%,telefone.ilike.%${term}%,email.ilike.%${term}%,cidade.ilike.%${term}%`,
        );
      }

      const { data, error } = await request;
      if (error) throw error;
      return (data ?? []) as OportunidadeB2b[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("oportunidades-b2b-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "oportunidades_b2b" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["oportunidades-b2b"] });
          void queryClient.invalidateQueries({ queryKey: ["kpis-pipeline-b2b"] });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return query;
}

export function useKpisPipelineB2b() {
  return useQuery({
    queryKey: ["kpis-pipeline-b2b"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_kpis_pipeline_b2b").select("*").maybeSingle();
      if (error) throw error;
      return (data ?? {
        total_oportunidades: 0,
        fechados: 0,
        em_andamento: 0,
        taxa_fechamento_pct: null,
        mrr: 0,
        ticket_medio_b2b: null,
      }) as KpisPipelineB2b;
    },
  });
}

export async function moverOportunidadeB2bStatus(id: string, novo: PipelineB2bStatus) {
  const { error } = await supabase.rpc("mover_oportunidade_b2b_status", {
    _id: id,
    _novo: novo,
  });
  if (error) throw error;
}

export async function createOportunidadeB2b(input: {
  nome: string;
  email?: string | null;
  telefone?: string | null;
  origem?: string | null;
  especialidade?: string | null;
  cidade?: string | null;
  canal?: string | null;
  responsavel_id?: string | null;
  ticket?: number | null;
  roi?: number | null;
  cac?: number | null;
  observacoes?: string | null;
  status?: PipelineB2bStatus;
}): Promise<OportunidadeB2b> {
  const { data, error } = await supabase
    .from("oportunidades_b2b")
    .insert({
      nome: input.nome.trim(),
      email: input.email?.trim() || null,
      telefone: input.telefone?.trim() || null,
      origem: input.origem?.trim() || null,
      especialidade: input.especialidade?.trim() || null,
      cidade: input.cidade?.trim() || null,
      canal: input.canal?.trim() || null,
      responsavel_id: input.responsavel_id || null,
      ticket: input.ticket ?? null,
      roi: input.roi ?? null,
      cac: input.cac ?? null,
      observacoes: input.observacoes?.trim() || null,
      status: input.status ?? "novo_lead",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as OportunidadeB2b;
}

export async function updateOportunidadeB2b(
  id: string,
  patch: Partial<{
    nome: string;
    email: string | null;
    telefone: string | null;
    origem: string | null;
    especialidade: string | null;
    cidade: string | null;
    canal: string | null;
    responsavel_id: string | null;
    ticket: number | null;
    roi: number | null;
    cac: number | null;
    observacoes: string | null;
    status: PipelineB2bStatus;
  }>,
): Promise<OportunidadeB2b> {
  const { data, error } = await supabase
    .from("oportunidades_b2b")
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as OportunidadeB2b;
}
