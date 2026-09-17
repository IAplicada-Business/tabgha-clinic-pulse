// Nutrição de leads · lógica compartilhada do motor (Deno).
//
// Espelho de src/lib/nutricao.ts — os textos e gatilhos NÃO ficam aqui, vêm de
// app_config.chave = 'nurture_defaults'. Só a lógica de render/agendamento mora
// neste arquivo. Ao mudar renderNutricaoTexto ou VARIAVEIS_LINK, mude nos dois.

export const SEQUENCIAS = ["seq_a", "seq_b", "seq_c"] as const;
export type SequenciaKey = (typeof SEQUENCIAS)[number];

export const SEQUENCIA_LETRA: Record<SequenciaKey, string> = {
  seq_a: "A",
  seq_b: "B",
  seq_c: "C",
};

export type MensagemNutricao = { dia: number; texto: string };

export type SequenciaConfig = {
  nome?: string;
  ativo?: boolean;
  gatilho_status?: string;
  gatilho_motivo_perda?: string | null;
  gatilho_idle_dias?: number | null;
  mensagens?: MensagemNutricao[];
};

export type NutricaoConfig = {
  timezone?: string;
  hora_envio?: number;
  sequencias?: Partial<Record<SequenciaKey, SequenciaConfig>>;
};

export type NutricaoCliente = {
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

export const VARIAVEIS_LINK = [
  "link_material",
  "link_conteudo_autoridade",
  "link_google_avaliacao",
] as const;

/** Substitui {variavel}; deixa o placeholder intacto quando não há valor. */
export function renderNutricaoTexto(
  texto: string,
  vars: Record<string, string | undefined>,
): string {
  return texto.replace(/\{(\w+)\}/g, (match, chave: string) => {
    const valor = vars[chave];
    return valor === undefined || valor === null ? match : String(valor);
  });
}

export function variaveisUsadas(texto: string): string[] {
  return [...new Set([...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
}

export function primeiroNome(nome: string | null | undefined): string {
  return (nome ?? "").trim().split(/\s+/)[0] ?? "";
}

export function lerNutricaoCliente(dadosExtras: unknown): NutricaoCliente {
  if (!dadosExtras || typeof dadosExtras !== "object") return {};
  const bloco = (dadosExtras as Record<string, unknown>).nutricao;
  if (!bloco || typeof bloco !== "object" || Array.isArray(bloco)) return {};
  return bloco as NutricaoCliente;
}

export function sequenciaAtivaParaCliente(
  seq: SequenciaKey,
  config: SequenciaConfig | undefined,
  cliente: NutricaoCliente,
): boolean {
  if (!config?.ativo) return false;
  if (cliente.ativo === false) return false;
  return cliente[seq] !== false;
}

export function varsDoCliente(opts: {
  nomeLead?: string | null;
  clienteNome?: string | null;
  especialidade?: string | null;
  nutricao?: NutricaoCliente | null;
  redes?: Record<string, string> | null;
}): Record<string, string | undefined> {
  const n = opts.nutricao ?? {};
  const redes = opts.redes ?? {};
  const googleFallback = redes.google_review || redes.google || "";

  const out: Record<string, string | undefined> = {};
  const set = (chave: string, valor: string | null | undefined) => {
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

// ── Agendamento com fuso do cliente ─────────────────────────────────────────

/** Offset (ms) do fuso em relação ao UTC no instante informado. */
function offsetDoFuso(instante: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(instante)) p[part.type] = part.value;
  const comoUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return comoUtc - instante.getTime();
}

/** Data/hora local (no fuso) convertida para o instante UTC correspondente. */
function localParaUtc(
  ano: number,
  mes: number,
  dia: number,
  hora: number,
  timeZone: string,
): Date {
  let palpite = Date.UTC(ano, mes - 1, dia, hora, 0, 0, 0);
  // Duas passadas cobrem viradas de offset (o Brasil não usa horário de verão).
  for (let i = 0; i < 2; i++) {
    palpite = Date.UTC(ano, mes - 1, dia, hora, 0, 0, 0) - offsetDoFuso(new Date(palpite), timeZone);
  }
  return new Date(palpite);
}

/** Componentes de data no fuso informado. */
function partesLocais(instante: Date, timeZone: string) {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [ano, mes, dia] = dtf.format(instante).split("-").map(Number);
  return { ano, mes, dia };
}

/**
 * Quando a mensagem do dia N deve sair: dia do gatilho + N dias, às
 * `hora` local do fuso do cliente.
 */
export function agendarEnvio(
  gatilho: Date,
  diasDepois: number,
  hora: number,
  timeZone: string,
): Date {
  const { ano, mes, dia } = partesLocais(gatilho, timeZone);
  // Date.UTC normaliza estouro de mês/ano.
  const alvo = new Date(Date.UTC(ano, mes - 1, dia + diasDepois));
  return localParaUtc(
    alvo.getUTCFullYear(),
    alvo.getUTCMonth() + 1,
    alvo.getUTCDate(),
    hora,
    timeZone,
  );
}

/** Fuso do cliente, com fallback no global e depois em São Paulo. */
export function fusoDoCliente(cliente: NutricaoCliente, config: NutricaoConfig): string {
  const tz = (cliente.timezone || config.timezone || TIMEZONE_PADRAO).trim();
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return TIMEZONE_PADRAO;
  }
}

export function horaDeEnvio(config: NutricaoConfig): number {
  const h = Number(config.hora_envio ?? 10);
  return Number.isFinite(h) ? Math.max(0, Math.min(23, Math.trunc(h))) : 10;
}
