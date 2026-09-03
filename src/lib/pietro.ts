/**
 * Cérebro Pietro — helpers compartilhados (frontend).
 *
 * Fonte única para:
 *  - config global do agente (app_config.pietro_brain_defaults)
 *  - flag "agente ativo" por cliente (whatsapp_instances + fallback legado em clientes)
 *  - rótulos/formatação das notas que o bot grava em whatsapp_conversations.bot_notes
 *
 * O espelho backend está em supabase/functions/_shared/pietro_brain.ts (Deno não
 * importa de src/, por isso as constantes FONTES_7 / chave de config são repetidas lá).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const PIETRO_DEFAULTS_KEY = "pietro_brain_defaults";

export const FONTES_7 = [
  "Posicionamento",
  "Presença digital",
  "Aquisição de pacientes",
  "Conversão",
  "Experiência do paciente",
  "Inteligência de dados",
  "Escala",
] as const;

export const PIETRO_MODEL_OPTIONS = [
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 · rápido e econômico" },
  { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
  { value: "claude-sonnet-5", label: "Claude Sonnet 5" },
] as const;

export type PietroDefaults = {
  model?: string;
  system_prompt?: string | null;
  max_history?: number;
  temperature?: number;
  max_tokens?: number;
  reengage_hours?: number;
  handoff_score?: number;
  handoff_message?: string;
  /** Legado: só usado quando não há system_prompt (global nem do cliente). */
  metodo_qualificacao?: string;
};

export const PIETRO_FALLBACK: Required<
  Omit<PietroDefaults, "system_prompt" | "metodo_qualificacao">
> = {
  model: "claude-haiku-4-5-20251001",
  max_history: 30,
  temperature: 0.5,
  max_tokens: 400,
  reengage_hours: 4,
  handoff_score: 75,
  handoff_message: "Vou te conectar agora com nosso time. Um momento.",
};

export async function loadPietroDefaults(): Promise<PietroDefaults> {
  const { data, error } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", PIETRO_DEFAULTS_KEY)
    .maybeSingle();
  if (error) throw error;
  return ((data?.valor ?? {}) as PietroDefaults) ?? {};
}

/** Merge raso com o que já existe no banco (não apaga chaves desconhecidas). */
export async function savePietroDefaults(patch: PietroDefaults): Promise<void> {
  const current = await loadPietroDefaults();
  const next = { ...current, ...patch } as Record<string, unknown>;
  const { error } = await supabase
    .from("app_config")
    .upsert(
      { chave: PIETRO_DEFAULTS_KEY, valor: next as Json, atualizado_em: new Date().toISOString() },
      { onConflict: "chave" },
    );
  if (error) throw error;
}

// ── Agente ativo por cliente ──────────────────────────────────────────────────

type Extras = Record<string, unknown> | null | undefined;

function flag(v: unknown): boolean {
  return v === true || v === "true";
}

/** Prioridade: whatsapp_instances.dados_extras.agente_ativo → clientes.dados_extras.automacoes.zapi.agente_ativo */
export function readAgenteAtivo(instanceExtras: Extras, clienteExtras: Extras): boolean {
  if (instanceExtras && "agente_ativo" in instanceExtras) return flag(instanceExtras.agente_ativo);
  const automacoes = (clienteExtras?.automacoes ?? {}) as Record<string, unknown>;
  const zapi = (automacoes.zapi ?? {}) as Record<string, unknown>;
  return flag(zapi.agente_ativo);
}

/** Propaga a flag para todas as instâncias WhatsApp do cliente (fonte lida pelo whatsapp-inbound). */
export async function syncAgenteAtivoInstances(clienteId: string, ativo: boolean): Promise<void> {
  const { data: instances, error } = await supabase
    .from("whatsapp_instances")
    .select("id, dados_extras")
    .eq("cliente_id", clienteId);
  if (error) throw error;
  for (const instance of instances ?? []) {
    const extras = {
      ...((instance.dados_extras as Record<string, unknown> | null) ?? {}),
      agente_ativo: ativo,
    };
    const { error: e } = await supabase
      .from("whatsapp_instances")
      .update({ dados_extras: extras as Json })
      .eq("id", instance.id);
    if (e) throw e;
  }
}

/** Liga/desliga o agente de um cliente gravando nos dois lugares que o backend lê. */
export async function saveAgenteAtivo(clienteId: string, ativo: boolean): Promise<void> {
  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("dados_extras")
    .eq("id", clienteId)
    .single();
  if (error) throw error;
  const base = (cliente.dados_extras ?? {}) as Record<string, unknown>;
  const automacoes = (base.automacoes ?? {}) as Record<string, unknown>;
  const zapi = (automacoes.zapi ?? {}) as Record<string, unknown>;
  const next = {
    ...base,
    automacoes: { ...automacoes, zapi: { ...zapi, agente_ativo: ativo } },
  };
  const { error: e } = await supabase
    .from("clientes")
    .update({ dados_extras: next as Json })
    .eq("id", clienteId);
  if (e) throw e;
  await syncAgenteAtivoInstances(clienteId, ativo);
}

// ── Notas do bot (bot_notes) ──────────────────────────────────────────────────

export const BOT_NOTE_FIELDS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "resumo", label: "Resumo" },
  { key: "dor_principal", label: "Dor principal" },
  { key: "fonte_tocada", label: "Fontes tocadas" },
  { key: "maturidade_percebida", label: "Maturidade percebida" },
  { key: "agendamento_sugerido", label: "Agendamento sugerido" },
  { key: "passou_para_humano", label: "Passou para humano" },
  { key: "passou_para_humano_motivo", label: "Motivo da passagem" },
  { key: "especialidade", label: "Especialidade" },
  { key: "cidade", label: "Cidade" },
  { key: "intencao", label: "Intenção" },
  { key: "urgencia", label: "Urgência" },
  { key: "fit", label: "Fit" },
  { key: "capacidade", label: "Capacidade" },
  { key: "last_handoff_reason", label: "Último motivo de handoff" },
];

const HIDDEN_NOTE_KEYS = new Set(["updated_at", "reengage_sent_at", "nome"]);

export function isHiddenBotNote(key: string): boolean {
  return HIDDEN_NOTE_KEYS.has(key);
}

export function formatBotNote(key: string, value: unknown): string | null {
  if (value == null || value === "") return null;
  if (key === "fonte_tocada") {
    const arr = Array.isArray(value) ? value : [value];
    const names = arr
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= 7)
      .map((n) => `${n}·${FONTES_7[n - 1]}`);
    return names.length ? names.join(", ") : null;
  }
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (key === "maturidade_percebida") {
    const v = String(value).toLowerCase();
    return v === "media" ? "média" : v;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
