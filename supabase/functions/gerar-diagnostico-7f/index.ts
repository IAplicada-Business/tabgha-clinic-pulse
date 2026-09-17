// Edge Function: gerar-diagnostico-7f
// Gera o plano de ação do Diagnóstico das 7 Fontes a partir dos scores já
// calculados em diagnostico_scores e grava em diagnostico_relatorios.
//
// POST { cliente_id: string }
// Auth: JWT do caller, repassado pro client Supabase — RLS (is_staff) decide
// quem pode ler/gravar. Não há bypass de service_role aqui de propósito.
//
// Saída (diagnostico_relatorios):
//   resumo_executivo → parágrafo executivo + frase de convite
//   por_fonte        → as 3 Fontes mais fracas, cada uma com diagnóstico,
//                      ação de 30 dias e ferramenta Tabgha OS
// As outras 4 Fontes aparecem na tela com a frase da faixa
// (diagnostico_frases_por_faixa), não com texto de IA.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-expect-error Deno global
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-expect-error Deno global
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
// @ts-expect-error Deno global
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

/** Dias de validade do link público do relatório. */
const LINK_VALIDADE_DIAS = 30;

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
  if (fenceMatch) text = fenceMatch[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) text = text.slice(start, end + 1);
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

const FONTE_NUMERO: Record<Fonte, number> = {
  posicionamento: 1,
  presenca_digital: 2,
  aquisicao_pacientes: 3,
  conversao: 4,
  experiencia_paciente: 5,
  inteligencia_dados: 6,
  escala: 7,
};

/** Mesma régua do frontend (src/lib/fontes.ts): 0-25 · 26-50 · 51-75 · 76-100. */
function classificacao(score: number | null): string {
  if (score == null) return "Sem resposta";
  if (score <= 25) return "Iniciante";
  if (score <= 50) return "Em desenvolvimento";
  if (score <= 75) return "Consolidado";
  return "Avançado";
}

type FontePrioridade = {
  diagnostico: string;
  acao_30_dias: string;
  ferramenta_tabgha: string;
};

async function callClaude(system: string, userPrompt: string, maxTokens = 2000) {
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
      .select("id, nome, especialidade, dados_extras")
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

    const comScore = (scores ?? []).filter((s) => s.score != null);
    if (comScore.length === 0) {
      return json(
        {
          ok: false,
          error:
            "Sem respostas suficientes na autoavaliação das 7 Fontes ainda. Peça ao cliente para preencher o questionário antes de gerar o plano.",
        },
        400,
      );
    }

    const scorePorFonte = new Map<string, number | null>();
    for (const s of scores ?? []) scorePorFonte.set(s.fonte, s.score);

    const scoreGeral =
      Math.round(
        (comScore.reduce((acc, s) => acc + Number(s.score ?? 0), 0) / comScore.length) * 100,
      ) / 100;

    // As 3 Fontes mais fracas — é sobre elas que o plano fala.
    const maisFracas = [...comScore]
      .sort((a, b) => Number(a.score ?? 0) - Number(b.score ?? 0))
      .slice(0, 3)
      .map((s) => s.fonte as Fonte);

    const cidade =
      ((cliente.dados_extras as Record<string, unknown> | null)?.cidade as string | undefined) ??
      "não informada";

    const linhasScore = FONTES.map(
      (f) =>
        `- Nota Fonte ${FONTE_NUMERO[f]} ${FONTE_LABEL[f]}: ${
          scorePorFonte.get(f) != null ? `${scorePorFonte.get(f)}/100` : "sem resposta"
        }`,
    ).join("\n");

    const system = `Você é um consultor sênior da Tabgha OS. Analise o diagnóstico 7 Fontes de um médico e gere um plano de ação personalizado.

Gere:
1. Um parágrafo executivo de 3-4 frases sintetizando o cenário atual da clínica.
2. As 3 Fontes mais fracas em ordem, cada uma com:
   - Diagnóstico em 2 linhas do que está travando.
   - 1 ação prioritária concreta para os próximos 30 dias.
   - Ferramenta ou processo Tabgha OS que endereça essa Fonte.
3. Uma frase final convidando à sessão de aprofundamento.

Tom: consultivo, direto, sem generalidades. Máximo 400 palavras no total.
Não use bullets no parágrafo executivo. Baseie-se somente nas notas informadas — não invente dados sobre a clínica.

Responda APENAS com o objeto JSON abaixo. Sem texto antes ou depois, sem blocos de código markdown — a resposta inteira começa com { e termina com }.
{
  "resumo_executivo": "parágrafo executivo de 3-4 frases, sem bullets",
  "prioridades": [
    { "fonte": "slug da Fonte", "diagnostico": "2 linhas do que está travando", "acao_30_dias": "1 ação concreta", "ferramenta_tabgha": "ferramenta ou processo Tabgha OS" }
  ],
  "convite": "frase final convidando à sessão de aprofundamento"
}
Os slugs válidos são: ${FONTES.join(", ")}. Use exatamente as 3 Fontes mais fracas informadas, na ordem dada.`;

    const userPrompt = `Dados do diagnóstico:
- Nome: ${cliente.nome}
- Especialidade: ${cliente.especialidade ?? "não informada"}
- Cidade: ${cidade}
- Nota geral: ${scoreGeral}/100 (${classificacao(scoreGeral)})
${linhasScore}

As 3 Fontes mais fracas, em ordem: ${maisFracas
      .map((f) => `${FONTE_LABEL[f]} (${f}, ${scorePorFonte.get(f)}/100)`)
      .join(" · ")}`;

    const raw = await callClaude(system, userPrompt);
    let parsed: {
      resumo_executivo?: string;
      prioridades?: Array<Partial<FontePrioridade> & { fonte?: string }>;
      convite?: string;
    };
    try {
      parsed = JSON.parse(extractJson(raw));
    } catch {
      return json(
        { ok: false, error: "Resposta da IA não é JSON válido.", raw: raw.slice(0, 4000) },
        502,
      );
    }

    // por_fonte fica com as 3 prioridades; as outras 4 usam a frase da faixa na tela.
    const porFonte: Record<string, FontePrioridade> = {};
    for (const p of parsed.prioridades ?? []) {
      const slug = String(p.fonte ?? "") as Fonte;
      if (!FONTES.includes(slug)) continue;
      porFonte[slug] = {
        diagnostico: String(p.diagnostico ?? "").trim(),
        acao_30_dias: String(p.acao_30_dias ?? "").trim(),
        ferramenta_tabgha: String(p.ferramenta_tabgha ?? "").trim(),
      };
    }

    const convite = String(parsed.convite ?? "").trim();
    const resumo = [String(parsed.resumo_executivo ?? "").trim(), convite]
      .filter(Boolean)
      .join("\n\n");

    if (!resumo) {
      return json(
        { ok: false, error: "A IA não devolveu resumo utilizável.", raw: raw.slice(0, 2000) },
        502,
      );
    }

    const { data: userData } = await supabase.auth.getUser();

    // Link público: renova validade a cada geração; mantém o token se já existir
    // (o link que o cliente já recebeu continua valendo).
    const { data: existente } = await supabase
      .from("diagnostico_relatorios")
      .select("link_token")
      .eq("cliente_id", clienteId)
      .maybeSingle();

    const expira = new Date();
    expira.setDate(expira.getDate() + LINK_VALIDADE_DIAS);

    const { data: saved, error: saveErr } = await supabase
      .from("diagnostico_relatorios")
      .upsert(
        {
          cliente_id: clienteId,
          resumo_executivo: resumo,
          por_fonte: porFonte,
          score_geral: scoreGeral,
          gerado_por: userData?.user?.id ?? null,
          gerado_em: new Date().toISOString(),
          link_token: existente?.link_token ?? crypto.randomUUID(),
          link_expira_em: expira.toISOString(),
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
