/**
 * Nutrição de leads · tipos, variáveis e renderização.
 *
 * Fonte única do formato da configuração, que mora em
 * app_config.chave = 'nurture_defaults'. A edge function nurture-tick lê a
 * mesma linha; os textos NÃO são duplicados em código.
 *
 * O par Deno desse arquivo é supabase/functions/_shared/nutricao.ts — mantenha
 * `renderNutricaoTexto` e `VARIAVEIS` iguais nos dois lados.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export const SEQUENCIAS = ["seq_a", "seq_b", "seq_c"] as const;
export type SequenciaKey = (typeof SEQUENCIAS)[number];

export const SEQUENCIA_LETRA: Record<SequenciaKey, string> = {
  seq_a: "A",
  seq_b: "B",
  seq_c: "C",
};

/** Nome fixo de cada sequência (o campo "Nome (fixo)" da tela). */
export const SEQUENCIA_NOME: Record<SequenciaKey, string> = {
  seq_a: "Lead perdido sem plano de tratamento",
  seq_b: "Lead perdido sem resposta",
  seq_c: "Lead atendido",
};

export const SEQUENCIA_RESUMO: Record<SequenciaKey, string> = {
  seq_a: "Uma mensagem 7 dias depois de o card ser marcado como perdido sem plano.",
  seq_b: "Três mensagens depois de o card ficar parado esperando resposta.",
  seq_c: "Duas mensagens depois da consulta: avaliação no Google e retomada em 30 dias.",
};

export type MensagemNutricao = {
  /** Dias após o gatilho. */
  dia: number;
  texto: string;
};

export type SequenciaConfig = {
  nome: string;
  ativo: boolean;
  /** Status do funil que dispara a sequência. */
  gatilho_status: string;
  /** Só na Sequência A: além do status, exige este motivo de perda. */
  gatilho_motivo_perda?: string | null;
  /** Só na Sequência B: dias de inatividade no status antes de entrar. */
  gatilho_idle_dias?: number | null;
  mensagens: MensagemNutricao[];
};

export type NutricaoConfig = {
  /** Fuso padrão quando o cliente não define o dele. */
  timezone: string;
  /** Hora local do disparo (0-23). */
  hora_envio: number;
  sequencias: Record<SequenciaKey, SequenciaConfig>;
};

/** Ajustes por cliente, em clientes.dados_extras.nutricao. */
export type NutricaoCliente = {
  /** Desliga as três sequências de uma vez para este cliente. */
  ativo?: boolean;
  seq_a?: boolean;
  seq_b?: boolean;
  seq_c?: boolean;
  timezone?: string;
  nome_medico?: string;
  tema_da_especialidade?: string;
  link_material?: string;
  link_conteudo_autoridade?: string;
  link_google_avaliacao?: string;
};

export const TIMEZONE_PADRAO = "America/Sao_Paulo";

export const VARIAVEIS = [
  {
    chave: "primeiro_nome",
    label: "{primeiro_nome}",
    descricao: "Primeiro nome do lead",
    exemplo: "Marina",
  },
  {
    chave: "nome_medico",
    label: "{nome_medico}",
    descricao: "Nome do médico responsável no cliente",
    exemplo: "Dr. Pedro Correa",
  },
  {
    chave: "tema_da_especialidade",
    label: "{tema_da_especialidade}",
    descricao: "Texto contextual da especialidade do cliente",
    exemplo: "harmonização facial",
  },
  {
    chave: "link_material",
    label: "{link_material}",
    descricao: "URL do material de apoio (por cliente)",
    exemplo: "https://tabgha.com.br/material",
  },
  {
    chave: "link_conteudo_autoridade",
    label: "{link_conteudo_autoridade}",
    descricao: "URL do conteúdo de autoridade (por cliente)",
    exemplo: "https://tabgha.com.br/conteudo",
  },
  {
    chave: "link_google_avaliacao",
    label: "{link_google_avaliacao}",
    descricao: "URL da avaliação no Google (por cliente)",
    exemplo: "https://g.page/r/exemplo/review",
  },
] as const;

export type VariavelChave = (typeof VARIAVEIS)[number]["chave"];

/** Variáveis de link — se faltarem, a mensagem não é enviada. */
export const VARIAVEIS_LINK: VariavelChave[] = [
  "link_material",
  "link_conteudo_autoridade",
  "link_google_avaliacao",
];

/** Substitui {variavel} pelos valores. Valor ausente vira string vazia. */
export function renderNutricaoTexto(
  texto: string,
  vars: Partial<Record<VariavelChave, string>>,
): string {
  return texto.replace(/\{(\w+)\}/g, (match, chave: string) => {
    const valor = vars[chave as VariavelChave];
    return valor === undefined || valor === null ? match : String(valor);
  });
}

/** Quais variáveis um texto usa. */
export function variaveisUsadas(texto: string): string[] {
  return [...new Set([...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
}

/** Preenche com os exemplos — usado no preview da tela. */
export function varsDeExemplo(): Record<VariavelChave, string> {
  return Object.fromEntries(VARIAVEIS.map((v) => [v.chave, v.exemplo])) as Record<
    VariavelChave,
    string
  >;
}

export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Variáveis reais de um cliente. `nomeLead` vem do lead; o resto do cadastro.
 * Devolve undefined nas variáveis não configuradas para o motor conseguir
 * distinguir "vazio" de "não configurado".
 */
export function varsDoCliente(opts: {
  nomeLead?: string | null;
  clienteNome?: string | null;
  especialidade?: string | null;
  nutricao?: NutricaoCliente | null;
  redes?: Record<string, string> | null;
}): Partial<Record<VariavelChave, string>> {
  const n = opts.nutricao ?? {};
  const redes = opts.redes ?? {};
  const googleFallback = redes.google_review || redes.google || "";

  const out: Partial<Record<VariavelChave, string>> = {};
  const set = (chave: VariavelChave, valor: string | null | undefined) => {
    const v = (valor ?? "").trim();
    if (v) out[chave] = v;
  };

  set("primeiro_nome", primeiroNome(opts.nomeLead));
  set("nome_medico", n.nome_medico || opts.clienteNome);
  set("tema_da_especialidade", n.tema_da_especialidade || opts.especialidade);
  set("link_material", n.link_material);
  set("link_conteudo_autoridade", n.link_conteudo_autoridade);
  set("link_google_avaliacao", n.link_google_avaliacao || googleFallback);
  return out;
}

/** Lê o bloco de nutrição de clientes.dados_extras. */
export function lerNutricaoCliente(dadosExtras: unknown): NutricaoCliente {
  if (!dadosExtras || typeof dadosExtras !== "object") return {};
  const bloco = (dadosExtras as Record<string, unknown>).nutricao;
  if (!bloco || typeof bloco !== "object" || Array.isArray(bloco)) return {};
  return bloco as NutricaoCliente;
}

/** A sequência está ligada para este cliente? */
export function sequenciaAtivaParaCliente(
  seq: SequenciaKey,
  config: SequenciaConfig | undefined,
  cliente: NutricaoCliente,
): boolean {
  if (!config?.ativo) return false;
  if (cliente.ativo === false) return false;
  return cliente[seq] !== false;
}

// ── Persistência ─────────────────────────────────────────────────────────────
// Mesma chave lida pelo nurture-tick: app_config.chave = 'nurture_defaults'.

export const NUTRICAO_CONFIG_KEY = "nurture_defaults";

export const NUTRICAO_FALLBACK: NutricaoConfig = {
  timezone: TIMEZONE_PADRAO,
  hora_envio: 10,
  sequencias: {
    seq_a: {
      nome: SEQUENCIA_NOME.seq_a,
      ativo: false,
      gatilho_status: "perdido",
      gatilho_motivo_perda: "sem_plano",
      mensagens: [],
    },
    seq_b: {
      nome: SEQUENCIA_NOME.seq_b,
      ativo: false,
      gatilho_status: "em_conversa",
      gatilho_idle_dias: 5,
      mensagens: [],
    },
    seq_c: {
      nome: SEQUENCIA_NOME.seq_c,
      ativo: false,
      gatilho_status: "atendido",
      mensagens: [],
    },
  },
};

export async function loadNutricaoConfig(): Promise<NutricaoConfig> {
  const { data, error } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", NUTRICAO_CONFIG_KEY)
    .maybeSingle();
  if (error) throw error;
  const valor = (data?.valor ?? {}) as Partial<NutricaoConfig>;
  return {
    timezone: valor.timezone ?? NUTRICAO_FALLBACK.timezone,
    hora_envio: valor.hora_envio ?? NUTRICAO_FALLBACK.hora_envio,
    sequencias: {
      seq_a: { ...NUTRICAO_FALLBACK.sequencias.seq_a, ...(valor.sequencias?.seq_a ?? {}) },
      seq_b: { ...NUTRICAO_FALLBACK.sequencias.seq_b, ...(valor.sequencias?.seq_b ?? {}) },
      seq_c: { ...NUTRICAO_FALLBACK.sequencias.seq_c, ...(valor.sequencias?.seq_c ?? {}) },
    },
  };
}

export async function saveNutricaoConfig(config: NutricaoConfig): Promise<void> {
  const { error } = await supabase.from("app_config").upsert(
    {
      chave: NUTRICAO_CONFIG_KEY,
      valor: config as unknown as Json,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "chave" },
  );
  if (error) throw error;
}

/** Grava o bloco de nutrição do cliente sem apagar o resto de dados_extras. */
export async function saveNutricaoCliente(
  clienteId: string,
  patch: NutricaoCliente,
): Promise<void> {
  const { data: cliente, error } = await supabase
    .from("clientes")
    .select("dados_extras")
    .eq("id", clienteId)
    .single();
  if (error) throw error;
  const base = (cliente.dados_extras ?? {}) as Record<string, unknown>;
  const atual = lerNutricaoCliente(base);
  const next = { ...base, nutricao: { ...atual, ...patch } };
  const { error: e } = await supabase
    .from("clientes")
    .update({ dados_extras: next as unknown as Json })
    .eq("id", clienteId);
  if (e) throw e;
}
