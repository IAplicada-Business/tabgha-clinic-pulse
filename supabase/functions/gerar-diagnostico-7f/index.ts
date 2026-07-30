// Edge Function: gerar-diagnostico-7f
// Gera o relatório executivo do Diagnóstico das 7 Fontes (diagnóstico +
// oportunidades + plano de ação por Fonte) a partir das respostas/scores já
// salvos em diagnostico_respostas/diagnostico_scores, e grava em
// diagnostico_relatorios.
//
// POST { cliente_id: string }
// Auth: JWT do caller, repassado pro client Supabase — RLS (is_staff) decide
// quem pode ler/gravar. Não há bypass de service_role aqui de propósito.
//
// PLACEHOLDER: o questionário/rubrica que alimenta este relatório ainda é
// provisório (diagnostico_questoes.placeholder = true), pendente do Pietro.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-expect-error Deno global
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-expect-error Deno global
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
// @ts-expect-error Deno global
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function extractJson(raw: string): string {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    text = fenceMatch[1].trim();
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }
  return text;
}

const FONTES = [
  "posicionamento",
  "presenca_digital",
  "aquisicao_pacientes",
  "conversao",
  "experiencia_paciente",
  "inteligencia_dados",
  "escala",
] as const;
type Fonte = (typeof FONTES)[number];

const FONTE_LABEL: Record<Fonte, string> = {
  posicionamento: "Posicionamento",
  presenca_digital: "Presença Digital",
  aquisicao_pacientes: "Aquisição de Pacientes",
  conversao: "Conversão",
  experiencia_paciente: "Experiência do Paciente",
  inteligencia_dados: "Inteligência de Dados",
  escala: "Escala",
};

type FonteRelatorio = { diagnostico: string; oportunidades: string[]; plano_acao: string[] };

async function callClaude(system: string, userPrompt: string, maxTokens = 4096) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw { status: 502, body: { ok: false, error: "Erro na API Claude.", detail: err } };
  }

  const data = (await res.json()) as { content: { text: string }[] };
  return data.content?.[0]?.text ?? "";
}

// @ts-expect-error Deno global
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  if (!ANTHROPIC_KEY) {
    return json(
      { ok: false, error: "ANTHROPIC_API_KEY não configurada no ambiente Supabase." },
      500,
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ ok: false, error: "unauthorized" }, 401);
  if (!ANON_KEY) return json({ ok: false, error: "anon_key_missing" }, 500);

  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  let body: { cliente_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const clienteId = body.cliente_id;
  if (!clienteId) return json({ ok: false, error: "missing_cliente_id" }, 400);

  try {
    const { data: cliente, error: clienteErr } = await supabase
      .from("clientes")
      .select("id, nome, especialidade")
      .eq("id", clienteId)
      .maybeSingle();
    if (clienteErr) throw clienteErr;
    if (!cliente) {
      return json({ ok: false, error: "Cliente não encontrado (ou sem permissão)." }, 404);
    }

    const { data: scores, error: scoresErr } = await supabase
      .from("diagnostico_scores")
      .select("fonte, score, respondidas, total")
      .eq("cliente_id", clienteId);
    if (scoresErr) throw scoresErr;

    if (!scores || scores.length === 0) {
      return json(
        {
          ok: false,
          error:
            "Sem respostas suficientes na autoavaliação das 7 Fontes ainda. Peça ao cliente para preencher o questionário antes de gerar o relatório.",
        },
        400,
      );
    }

    const { data: respostas, error: respostasErr } = await supabase
      .from("diagnostico_respostas")
      .select("valor_num, valor_texto, questao:diagnostico_questoes(fonte, pergunta, ordem)")
      .eq("cliente_id", clienteId);
    if (respostasErr) throw respostasErr;

    type RespostaRow = {
      valor_num: number | null;
      valor_texto: string | null;
      questao: { fonte: Fonte; pergunta: string; ordem: number } | null;
    };

    const porFonteInput = FONTES.map((fonte) => {
      const score = scores.find((s) => s.fonte === fonte);
      const perguntas = ((respostas ?? []) as RespostaRow[])
        .filter((r) => r.questao?.fonte === fonte)
        .sort((a, b) => (a.questao?.ordem ?? 0) - (b.questao?.ordem ?? 0))
        .map((r) => `- ${r.questao?.pergunta}: ${r.valor_num ?? r.valor_texto ?? "sem resposta"}`)
        .join("\n");
      return `### ${FONTE_LABEL[fonte]} (score: ${score?.score != null ? `${score.score}/100` : "sem dados suficientes"})\n${perguntas || "sem respostas registradas"}`;
    }).join("\n\n");

    const scoreGeral =
      scores.length > 0
        ? Math.round(
            (scores.reduce((acc, s) => acc + Number(s.score ?? 0), 0) / scores.length) * 100,
          ) / 100
        : null;

    const system = `Você é consultor de growth marketing para clínicas médicas, aplicando o Método das 7 Fontes da Tabgha.
Analise a autoavaliação do cliente (respostas + score 0-100 por Fonte) e produza um relatório executivo.

REGRAS:
- Baseie-se SOMENTE nas respostas fornecidas; não invente dados que não foram informados.
- Para cada Fonte: diagnóstico curto (2-3 frases, direto, sem jargão), 2-4 oportunidades concretas, 2-4 itens de plano de ação priorizados.
- Score baixo (<40) = tom mais urgente; score alto (>=80) = reconhecer o que já funciona e sugerir próximo nível.
- Português do Brasil, direto, sem enrolação.
- Responda APENAS com o objeto JSON abaixo. Não inclua nenhum texto antes ou depois, não use
  blocos de código markdown (\`\`\`), não escreva introdução nem conclusão — a resposta inteira
  deve começar com { e terminar com }.
- Formato exato:
{
  "resumo_executivo": "string — 2-3 parágrafos com visão geral do consultório e prioridades",
  "por_fonte": {
    "posicionamento": { "diagnostico": "string", "oportunidades": ["string"], "plano_acao": ["string"] },
    "presenca_digital": { "diagnostico": "string", "oportunidades": ["string"], "plano_acao": ["string"] },
    "aquisicao_pacientes": { "diagnostico": "string", "oportunidades": ["string"], "plano_acao": ["string"] },
    "conversao": { "diagnostico": "string", "oportunidades": ["string"], "plano_acao": ["string"] },
    "experiencia_paciente": { "diagnostico": "string", "oportunidades": ["string"], "plano_acao": ["string"] },
    "inteligencia_dados": { "diagnostico": "string", "oportunidades": ["string"], "plano_acao": ["string"] },
    "escala": { "diagnostico": "string", "oportunidades": ["string"], "plano_acao": ["string"] }
  }
}`;

    const userPrompt = `Cliente: ${cliente.nome} (${cliente.especialidade ?? "especialidade não informada"})
Score geral: ${scoreGeral != null ? `${scoreGeral}/100` : "sem dados"}

${porFonteInput}`;

    const raw = await callClaude(system, userPrompt, 8192);
    let parsed: { resumo_executivo?: string; por_fonte?: Record<string, Partial<FonteRelatorio>> };
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      return json(
        { ok: false, error: "Resposta da IA não é JSON válido.", raw: raw.slice(0, 4000) },
        502,
      );
    }

    const porFonte: Record<string, FonteRelatorio> = {};
    for (const fonte of FONTES) {
      const f = parsed.por_fonte?.[fonte];
      porFonte[fonte] = {
        diagnostico: f?.diagnostico ?? "",
        oportunidades: Array.isArray(f?.oportunidades) ? f!.oportunidades! : [],
        plano_acao: Array.isArray(f?.plano_acao) ? f!.plano_acao! : [],
      };
    }

    const { data: userData } = await supabase.auth.getUser();

    const { data: saved, error: saveErr } = await supabase
      .from("diagnostico_relatorios")
      .upsert(
        {
          cliente_id: clienteId,
          resumo_executivo: parsed.resumo_executivo ?? "",
          por_fonte: porFonte,
          score_geral: scoreGeral,
          gerado_por: userData?.user?.id ?? null,
          gerado_em: new Date().toISOString(),
        },
        { onConflict: "cliente_id" },
      )
      .select()
      .single();

    if (saveErr) throw saveErr;

    return json({ ok: true, relatorio: saved });
  } catch (e) {
    if (e && typeof e === "object" && "status" in e && "body" in e) {
      const err = e as { status: number; body: unknown };
      return json(err.body, err.status);
    }
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
