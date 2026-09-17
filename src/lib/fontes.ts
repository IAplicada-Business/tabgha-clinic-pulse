/**
 * As 7 Fontes do Método Tabgha — estrutura, régua de pontuação e classificação.
 *
 * Escala das respostas: Likert de 5 opções valendo 0 / 25 / 50 / 75 / 100.
 * Score da Fonte  = média das 5 respostas (0-100).
 * Score geral     = média das 7 Fontes.
 *
 * Duas réguas convivem de propósito:
 *  - classificacao()  → Iniciante · Em desenvolvimento · Consolidado · Avançado
 *    (badge do score, tanto o geral quanto o de cada Fonte)
 *  - faixaFrase()     → 0-40 · 41-70 · 71-100
 *    (escolhe a frase diagnóstica em diagnostico_frases_por_faixa)
 */

export const FONTES = [
  "posicionamento",
  "presenca_digital",
  "aquisicao_pacientes",
  "conversao",
  "experiencia_paciente",
  "inteligencia_dados",
  "escala",
] as const;

export type Fonte = (typeof FONTES)[number];

export type FonteMeta = {
  slug: Fonte;
  numero: number;
  label: string;
  descricao: string;
  accent: "blue" | "violet" | "rose" | "amber" | "emerald" | "cyan" | "indigo";
};

export const FONTES_META: Record<Fonte, FonteMeta> = {
  posicionamento: {
    slug: "posicionamento",
    numero: 1,
    label: "Posicionamento",
    descricao: "Autoridade, nicho, diferenciais e proposta de valor para o paciente ideal.",
    accent: "blue",
  },
  presenca_digital: {
    slug: "presenca_digital",
    numero: 2,
    label: "Presença Digital",
    descricao: "Site, Google Perfil da Empresa, redes sociais e SEO.",
    accent: "violet",
  },
  aquisicao_pacientes: {
    slug: "aquisicao_pacientes",
    numero: 3,
    label: "Aquisição de Pacientes",
    descricao: "Campanhas, landing pages, CRM e custo por lead.",
    accent: "cyan",
  },
  conversao: {
    slug: "conversao",
    numero: 4,
    label: "Conversão",
    descricao: "WhatsApp, tempo de resposta, scripts e taxa de agendamento.",
    accent: "emerald",
  },
  experiencia_paciente: {
    slug: "experiencia_paciente",
    numero: 5,
    label: "Experiência do Paciente",
    descricao: "Jornada, NPS, avaliações, fidelização e indicações.",
    accent: "amber",
  },
  inteligencia_dados: {
    slug: "inteligencia_dados",
    numero: 6,
    label: "Inteligência de Dados",
    descricao: "KPIs, CAC, CPL, ROI, faturamento e previsibilidade.",
    accent: "rose",
  },
  escala: {
    slug: "escala",
    numero: 7,
    label: "Escala",
    descricao: "Automação, IA, processos, equipe e compliance.",
    accent: "indigo",
  },
};

export const FONTES_LIST: FonteMeta[] = FONTES.map((f) => FONTES_META[f]);

export function isFonte(value: unknown): value is Fonte {
  return typeof value === "string" && (FONTES as readonly string[]).includes(value);
}

// ── Escala de resposta ───────────────────────────────────────────────────────

/** As 5 opções da Likert, na ordem em que aparecem no formulário. */
export const ESCALA_OPCOES = [
  { valor: 0, label: "Discordo totalmente", curto: "Discordo tot." },
  { valor: 25, label: "Discordo", curto: "Discordo" },
  { valor: 50, label: "Neutro", curto: "Neutro" },
  { valor: 75, label: "Concordo", curto: "Concordo" },
  { valor: 100, label: "Concordo totalmente", curto: "Concordo tot." },
] as const;

export const VALORES_VALIDOS: readonly number[] = ESCALA_OPCOES.map((o) => o.valor);

export function isValorValido(v: unknown): v is number {
  return typeof v === "number" && VALORES_VALIDOS.includes(v);
}

// ── Classificação do score ───────────────────────────────────────────────────

export type Classificacao = "iniciante" | "em_desenvolvimento" | "consolidado" | "avancado";

export type ClassificacaoInfo = {
  key: Classificacao | "sem_resposta";
  label: string;
  tone: FaixaTone;
};

export type FaixaTone = "critico" | "atencao" | "bom" | "forte" | "neutro";

/** Régua oficial do diagnóstico: 0-25 · 26-50 · 51-75 · 76-100. */
export function classificacao(score: number | null | undefined): ClassificacaoInfo {
  if (score == null) return { key: "sem_resposta", label: "Sem resposta", tone: "neutro" };
  if (score <= 25) return { key: "iniciante", label: "Iniciante", tone: "critico" };
  if (score <= 50)
    return { key: "em_desenvolvimento", label: "Em desenvolvimento", tone: "atencao" };
  if (score <= 75) return { key: "consolidado", label: "Consolidado", tone: "bom" };
  return { key: "avancado", label: "Avançado", tone: "forte" };
}

/** Compat: nome antigo usado pelo PDF e pelas telas legadas. */
export const faixaScore = classificacao;

/** Faixa usada para escolher a frase diagnóstica da Fonte (0-40, 41-70, 71-100). */
export function faixaFrase(score: number | null | undefined): 0 | 41 | 71 | null {
  if (score == null) return null;
  if (score <= 40) return 0;
  if (score <= 70) return 41;
  return 71;
}

export const TONE_CLASS: Record<FaixaTone, string> = {
  critico: "bg-rose-50 text-rose-700",
  atencao: "bg-amber-50 text-amber-700",
  bom: "bg-sky-50 text-sky-700",
  forte: "bg-emerald-100 text-emerald-800",
  neutro: "bg-secondary text-muted-foreground",
};

/** Cor sólida (barras, radar, destaque do card). */
export const TONE_SOLID: Record<FaixaTone, string> = {
  critico: "bg-rose-500",
  atencao: "bg-amber-500",
  bom: "bg-sky-500",
  forte: "bg-emerald-500",
  neutro: "bg-muted-foreground/30",
};

// ── Helpers de cálculo (espelham o que o banco faz) ──────────────────────────

/** Média aritmética das 7 Fontes, arredondada a 1 casa. Null se nenhuma respondida. */
export function scoreGeral(scores: Array<number | null | undefined>): number | null {
  const validos = scores.filter((s): s is number => typeof s === "number");
  if (!validos.length) return null;
  return Math.round((validos.reduce((a, b) => a + b, 0) / validos.length) * 10) / 10;
}
