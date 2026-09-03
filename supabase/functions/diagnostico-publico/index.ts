// Edge Function: diagnostico-publico
// Leitura pública (sem login) do relatório do Diagnóstico das 7 Fontes via
// link com token. Usa service_role pra buscar por token e devolve só os
// campos necessários — RLS de diagnostico_relatorios/diagnostico_scores
// continua staff-only, sem policy nova pra anon.
//
// POST { token: string }
//
// RECUPERADA DO BANCO: esta função já estava publicada em produção (v1) mas o
// código não existia em nenhuma branch. Reposto aqui a partir do deploy ativo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-expect-error Deno global
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-expect-error Deno global
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type Payload = { token?: string };

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const token = payload.token?.trim();
  if (!token) {
    return json({ ok: false, error: "missing_token" }, 400);
  }

  try {
    const { data: relatorio, error } = await supabase
      .from("diagnostico_relatorios")
      .select(
        "cliente_id, resumo_executivo, por_fonte, score_geral, gerado_em, link_expira_em, clientes(nome, especialidade)",
      )
      .eq("link_token", token)
      .maybeSingle();

    if (error) throw error;
    if (!relatorio) {
      return json({ ok: false, error: "not_found" }, 404);
    }
    if (!relatorio.link_expira_em || new Date(relatorio.link_expira_em).getTime() < Date.now()) {
      return json({ ok: false, error: "expired" }, 410);
    }

    const { data: scores, error: scoresErr } = await supabase
      .from("diagnostico_scores")
      .select("fonte, score")
      .eq("cliente_id", relatorio.cliente_id);
    if (scoresErr) throw scoresErr;

    const clienteRel = relatorio.clientes as
      | { nome: string; especialidade: string | null }
      | { nome: string; especialidade: string | null }[]
      | null;
    const cliente = Array.isArray(clienteRel) ? clienteRel[0] : clienteRel;

    return json({
      ok: true,
      relatorio: {
        cliente_nome: cliente?.nome ?? "",
        especialidade: cliente?.especialidade ?? null,
        resumo_executivo: relatorio.resumo_executivo,
        por_fonte: relatorio.por_fonte,
        score_geral: relatorio.score_geral,
        gerado_em: relatorio.gerado_em,
        scores: scores ?? [],
      },
    });
  } catch (e) {
    console.error("diagnostico-publico error", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
