// Cérebro Pietro — prompt, gatilhos e parser da decisão do agente WhatsApp.
//
// Precedência do prompt do sistema:
//   1. clientes.dados_extras.agente_ia.system_prompt (override por cliente)
//   2. app_config.pietro_brain_defaults.system_prompt (global · Método 7 Fontes)
//   3. legado: buildPietroSystemPrompt (nome/tom/metodologia por cliente)
// Em todos os casos o contrato de saída JSON é acrescentado aqui, para o parser
// ser único. Espelho frontend das constantes: src/lib/pietro.ts.

export type PietroState = "greeting" | "qualifying" | "routing" | "handoff" | "agendado" | "closed";
export type PietroLeadStatus = "novo" | "em_conversa" | "interessado" | "agendado";
export type Maturidade = "baixa" | "media" | "alta";

export type PietroDecision = {
  reply: string;
  state: PietroState;
  bot_score: number;
  bot_notes: Record<string, unknown>;
  handoff: boolean;
  handoff_reason: string | null;
  lead_status: PietroLeadStatus | null;
  /** Fontes (1–7) tocadas nesta resposta. */
  fonte_tocada: number[];
  maturidade_percebida: Maturidade | null;
  agendamento_sugerido: boolean;
  lead: {
    nome: string | null;
    especialidade: string | null;
    cidade: string | null;
    dor_principal: string | null;
  };
  /** false quando o modelo não devolveu JSON utilizável. */
  parse_ok: boolean;
};

export type PietroDefaults = {
  model?: string;
  system_prompt?: string | null;
  max_history?: number;
  temperature?: number;
  max_tokens?: number;
  reengage_hours?: number;
  handoff_score?: number;
  handoff_message?: string;
  /** Legado (modo sem system_prompt). */
  metodo_qualificacao?: string;
};

export type PietroCliente = {
  nome?: string | null;
  especialidade?: string | null;
  dados_extras?: {
    agente_ia?: {
      system_prompt?: string | null;
      metodo_qualificacao?: string | null;
      tom?: string | null;
      nome_agente?: string | null;
    };
  } | null;
};

export const FONTES_7 = [
  "Posicionamento",
  "Presença digital",
  "Aquisição de pacientes",
  "Conversão",
  "Experiência do paciente",
  "Inteligência de dados",
  "Escala",
] as const;

export const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
export const DEFAULT_HANDOFF_MESSAGE = "Vou te conectar agora com nosso time. Um momento.";

const DEFAULT_METODO =
  "Avalie o lead de forma natural (sem interrogatório) em: (1) intenção — o que busca, (2) urgência — quando quer resolver, (3) fit — combina com a clínica, (4) capacidade — aberto a investir/agendar. Quando estiver qualificado ou pedir humano, faça handoff.";

const ALLOWED_STATES = new Set<PietroState>([
  "greeting",
  "qualifying",
  "routing",
  "handoff",
  "agendado",
  "closed",
]);

const ALLOWED_LEAD_STATUS = new Set<PietroLeadStatus>([
  "novo",
  "em_conversa",
  "interessado",
  "agendado",
]);

/**
 * Contrato de saída — único para todos os modos de prompt.
 * Mantido compacto porque max_tokens padrão é 400.
 */
export const OUTPUT_CONTRACT = `

FORMATO DE SAÍDA (obrigatório, sempre):
Responda APENAS com um JSON válido, sem markdown e sem texto fora do JSON:
{"reply":"mensagem para o lead","state":"greeting|qualifying|routing|handoff|agendado","bot_score":0,"handoff":false,"handoff_reason":null,"lead_status":"novo|em_conversa|interessado|agendado|null","fonte_tocada":[],"maturidade_percebida":"baixa|media|alta|null","agendamento_sugerido":false,"lead":{"nome":null,"especialidade":null,"cidade":null,"dor_principal":null},"bot_notes":{"resumo":""}}
Regras: "reply" é o único texto que o lead recebe. "fonte_tocada" = números 1–7 das Fontes abordadas nesta resposta (1 Posicionamento, 2 Presença digital, 3 Aquisição, 4 Conversão, 5 Experiência, 6 Inteligência de dados, 7 Escala). "maturidade_percebida" = sua leitura da operação do lead. "agendamento_sugerido" = true quando você propôs o Diagnóstico/agendamento. "lead" só com dados confirmados pelo lead (senão null). "bot_notes.resumo" com até 200 caracteres. Para passar a humano: handoff=true e state="handoff". Quando o lead aceitar data/horário: state="agendado" e lead_status="agendado".`;

/** Prompt legado (sem system_prompt): assistente da clínica, qualificação genérica. */
export function buildPietroSystemPrompt(
  cliente: PietroCliente,
  defaults?: { metodo_qualificacao?: string },
): string {
  const clinica = cliente.nome ?? "a clínica";
  const especialidade = cliente.especialidade ?? "saúde";
  const agenteNome = cliente.dados_extras?.agente_ia?.nome_agente ?? "assistente";
  const tom = cliente.dados_extras?.agente_ia?.tom ?? "acolhedor, claro e profissional";
  const metodo =
    cliente.dados_extras?.agente_ia?.metodo_qualificacao?.trim() ||
    defaults?.metodo_qualificacao?.trim() ||
    DEFAULT_METODO;

  return `Você é o ${agenteNome} virtual de WhatsApp da clínica "${clinica}" (${especialidade}), parte do cérebro Pietro / Tabgha.

Objetivo: qualificar o lead e conduzir até agendamento ou handoff para humano.
Tom: ${tom}. Responda sempre em português brasileiro.
Mensagens curtas (1–3 frases), naturais para WhatsApp. Sem markdown, sem listas longas.

Método de qualificação:
${metodo}

Regras de segurança:
- Nunca faça diagnóstico médico nem indique tratamento.
- Em emergência, dor intensa, risco ou pedido explícito de humano: handoff=true.
- Se o lead já estiver qualificado (score alto) e pronto para agenda: handoff=true e state=handoff ou agendado.
- Não invente preços, horários ou disponibilidade — diga que a equipe confirma.
Em "bot_notes" inclua também "intencao", "urgencia", "fit" e "capacidade" (1 frase cada).${OUTPUT_CONTRACT}`;
}

export type PromptSource = "cliente" | "global" | "legacy";

export function resolveSystemPrompt(
  cliente: PietroCliente,
  defaults: PietroDefaults,
): { system: string; source: PromptSource } {
  const own = cliente.dados_extras?.agente_ia?.system_prompt?.trim();
  if (own) return { system: own + OUTPUT_CONTRACT, source: "cliente" };
  const global = defaults.system_prompt?.trim();
  if (global) return { system: global + OUTPUT_CONTRACT, source: "global" };
  return {
    system: buildPietroSystemPrompt(cliente, { metodo_qualificacao: defaults.metodo_qualificacao }),
    source: "legacy",
  };
}

// ── Gatilhos determinísticos de passagem para humano ─────────────────────────

const HANDOFF_TRIGGERS = [
  // emergência / clínico
  "urgente",
  "muito forte",
  "sangue",
  "sangrando",
  "nao aguento",
  "emergencia",
  "socorro",
  "hospital",
  "internar",
  // pedido de humano
  "quero falar com pessoa",
  "falar com humano",
  "falar com uma pessoa",
  "atendente humano",
  "ser humano",
  "atendente de verdade",
  "atendente",
  "atendimento humano",
  "quero uma pessoa",
  "pessoa de verdade",
  "nao quero robo",
  "falar com alguem",
  "secretaria",
  // relacionamento / jurídico
  "cancelar contrato",
  "reclamacao",
  "processar",
  "devolver dinheiro",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function wantsHuman(text: string): boolean {
  const t = normalize(text);
  return HANDOFF_TRIGGERS.some((p) => t.includes(p));
}

// ── Parser ───────────────────────────────────────────────────────────────────

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function extractJson(clean: string): Record<string, unknown> | null {
  const tryParse = (s: string) => {
    try {
      const v = JSON.parse(s);
      return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(clean);
  if (direct) return direct;
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) return tryParse(clean.slice(start, end + 1));
  return null;
}

function str(v: unknown, max = 160): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function emptyDecision(): PietroDecision {
  return {
    reply: "",
    state: "qualifying",
    bot_score: 0,
    bot_notes: {},
    handoff: false,
    handoff_reason: null,
    lead_status: null,
    fonte_tocada: [],
    maturidade_percebida: null,
    agendamento_sugerido: false,
    lead: { nome: null, especialidade: null, cidade: null, dor_principal: null },
    parse_ok: false,
  };
}

/**
 * Nunca devolve JSON cru como reply. Se o modelo respondeu prosa sem JSON, usa a prosa.
 * Se respondeu JSON quebrado, tenta recuperar "reply"; senão reply="" e parse_ok=false
 * (o chamador decide a mensagem de fallback).
 */
export function parsePietroDecision(raw: string): PietroDecision {
  const clean = stripFences(raw ?? "");
  const parsed = extractJson(clean);

  if (!parsed) {
    const d = emptyDecision();
    if (!clean.includes("{") && clean.length > 0) {
      d.reply = clean.slice(0, 900);
      d.bot_score = 10;
      d.bot_notes = { resumo: "fallback_prosa" };
      d.lead_status = "em_conversa";
      return d;
    }
    const m = clean.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m) {
      try {
        d.reply = String(JSON.parse(`"${m[1]}"`)).trim().slice(0, 1200);
      } catch {
        d.reply = m[1].slice(0, 1200);
      }
      d.bot_score = 10;
      d.bot_notes = { resumo: "fallback_regex" };
      d.lead_status = "em_conversa";
    }
    return d;
  }

  const state = ALLOWED_STATES.has(parsed.state as PietroState)
    ? (parsed.state as PietroState)
    : "qualifying";

  const leadStatusRaw = parsed.lead_status as string | null | undefined;
  const lead_status =
    leadStatusRaw && ALLOWED_LEAD_STATUS.has(leadStatusRaw as PietroLeadStatus)
      ? (leadStatusRaw as PietroLeadStatus)
      : null;

  const score = Number(parsed.bot_score ?? 0);
  const bot_score = Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0;

  const fontesRaw = Array.isArray(parsed.fonte_tocada)
    ? parsed.fonte_tocada
    : parsed.fonte_tocada != null
      ? [parsed.fonte_tocada]
      : [];
  const fonte_tocada = [
    ...new Set(
      fontesRaw.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7),
    ),
  ].sort((a, b) => a - b);

  const matRaw = normalize(String(parsed.maturidade_percebida ?? ""));
  const maturidade_percebida: Maturidade | null =
    matRaw === "baixa" || matRaw === "media" || matRaw === "alta" ? matRaw : null;

  const leadObj = (parsed.lead && typeof parsed.lead === "object" ? parsed.lead : {}) as Record<
    string,
    unknown
  >;

  return {
    reply: String(parsed.reply ?? "")
      .trim()
      .slice(0, 1200),
    state,
    bot_score,
    bot_notes:
      parsed.bot_notes && typeof parsed.bot_notes === "object" && !Array.isArray(parsed.bot_notes)
        ? (parsed.bot_notes as Record<string, unknown>)
        : {},
    handoff: Boolean(parsed.handoff) || state === "handoff",
    handoff_reason: str(parsed.handoff_reason, 120),
    lead_status,
    fonte_tocada,
    maturidade_percebida,
    agendamento_sugerido: Boolean(parsed.agendamento_sugerido),
    lead: {
      nome: str(leadObj.nome, 80),
      especialidade: str(leadObj.especialidade, 80),
      cidade: str(leadObj.cidade, 80),
      dor_principal: str(leadObj.dor_principal, 200),
    },
    parse_ok: true,
  };
}
