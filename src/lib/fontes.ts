/**
 * As 7 Fontes do Blueprint Tabgha — estrutura oficial.
 *
 * PLACEHOLDER — revisar com Pietro (Etapa 4): os nomes e a ordem das Fontes são
 * definitivos, mas as descrições curtas abaixo e a rubrica de scoring ainda
 * precisam de validação. O questionário seedado no banco também é provisório
 * (diagnostico_questoes.placeholder = true).
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
    descricao: "Diferenciação, público-alvo e proposta de valor da clínica.",
    accent: "blue",
  },
  presenca_digital: {
    slug: "presenca_digital",
    numero: 2,
    label: "Presença Digital",
    descricao: "Redes sociais, site, Google e consistência da produção de conteúdo.",
    accent: "violet",
  },
  aquisicao_pacientes: {
    slug: "aquisicao_pacientes",
    numero: 3,
    label: "Aquisição de Pacientes",
    descricao: "Canais ativos, volume de contatos e custo por paciente.",
    accent: "cyan",
  },
  conversao: {
    slug: "conversao",
    numero: 4,
    label: "Conversão",
    descricao: "Velocidade de resposta, qualificação e follow-up até o agendamento.",
    accent: "emerald",
  },
  experiencia_paciente: {
    slug: "experiencia_paciente",
    numero: 5,
    label: "Experiência do Paciente",
    descricao: "Jornada antes, durante e depois da consulta, incluindo avaliações.",
    accent: "amber",
  },
  inteligencia_dados: {
    slug: "inteligencia_dados",
    numero: 6,
    label: "Inteligência de Dados",
    descricao: "Indicadores acompanhados e decisões tomadas com base em dados.",
    accent: "rose",
  },
  escala: {
    slug: "escala",
    numero: 7,
    label: "Escala",
    descricao: "Processos, time e capacidade de crescer sem depender de uma pessoa.",
    accent: "indigo",
  },
};

export const FONTES_LIST: FonteMeta[] = FONTES.map((f) => FONTES_META[f]);

/** Rótulos da escala 1–5 usada nas questões placeholder. */
export const ESCALA_LABELS: Record<number, string> = {
  1: "Não existe",
  2: "Começando",
  3: "Parcial",
  4: "Bom",
  5: "Consolidado",
};

export function isFonte(value: unknown): value is Fonte {
  return typeof value === "string" && (FONTES as readonly string[]).includes(value);
}

/** Faixa qualitativa do score 0–100 — PLACEHOLDER, pendente da rubrica do Pietro. */
export function faixaScore(score: number | null | undefined): {
  label: string;
  tone: "critico" | "atencao" | "bom" | "forte";
} {
  if (score == null) return { label: "Sem resposta", tone: "atencao" };
  if (score < 40) return { label: "Crítico", tone: "critico" };
  if (score < 60) return { label: "Atenção", tone: "atencao" };
  if (score < 80) return { label: "Bom", tone: "bom" };
  return { label: "Forte", tone: "forte" };
}
