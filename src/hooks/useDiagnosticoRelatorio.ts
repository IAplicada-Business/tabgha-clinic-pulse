import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type DiagnosticoRelatorio = Tables<"diagnostico_relatorios">;

export function useDiagnosticoRelatorio(clienteId: string | null | undefined) {
  return useQuery({
    queryKey: ["diagnostico", "relatorio", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diagnostico_relatorios")
        .select("*")
        .eq("cliente_id", clienteId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useGerarDiagnosticoRelatorio(clienteId: string | null | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Cliente não identificado.");
      const { data, error } = await supabase.functions.invoke("gerar-diagnostico-7f", {
        body: { cliente_id: clienteId },
      });
      const payload = data as {
        ok?: boolean;
        error?: string;
        raw?: string;
        relatorio?: DiagnosticoRelatorio;
      } | null;

      if (error) {
        let fromContext: string | undefined;
        let rawFromContext: string | undefined;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx) {
            const bodyJson = (await ctx.clone().json()) as { error?: string; raw?: string };
            fromContext = bodyJson?.error;
            rawFromContext = bodyJson?.raw;
          }
        } catch {
          /* ignore */
        }
        const message =
          payload?.error || fromContext || error.message || "Falha ao gerar relatório.";
        const raw = payload?.raw || rawFromContext;
        throw new Error(raw ? `${message} — resposta da IA: ${raw.slice(0, 300)}` : message);
      }
      if (!payload?.ok) {
        const raw = payload?.raw;
        const message = payload?.error || "Falha ao gerar relatório.";
        throw new Error(raw ? `${message} — resposta da IA: ${raw.slice(0, 300)}` : message);
      }
      return payload.relatorio!;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["diagnostico", "relatorio", clienteId] });
    },
  });
}
