/**
 * Biblioteca Criativa · pilares, formatos e status.
 *
 * Roda sobre public.conteudos — o módulo de aprovação de conteúdo que já
 * existia. Não há tabela "criativos" nem rota /admin/aprovacao-conteudo
 * paralela; o portal do cliente continua em /cliente/conteudo.
 */

import type { Tables } from "@/integrations/supabase/types";

export type Criativo = Tables<"conteudos">;
export type Comentario = Tables<"conteudo_comentarios">;

export const BUCKET_CRIATIVOS = "criativos";

// ── Pilares ─────────────────────────────────────────────────────────────────

export const PILARES = ["autoridade", "relacionamento", "conversao", "reputacao"] as const;
export type Pilar = (typeof PILARES)[number];

export const PILAR_LABEL: Record<Pilar, string> = {
  autoridade: "Autoridade",
  relacionamento: "Relacionamento",
  conversao: "Conversão",
  reputacao: "Reputação",
};

/** Cores do briefing: autoridade azul, relacionamento sky, conversão laranja, reputação navy. */
export const PILAR_CLASS: Record<Pilar, string> = {
  autoridade: "bg-blue-100 text-blue-800",
  relacionamento: "bg-sky-100 text-sky-800",
  conversao: "bg-amber-100 text-amber-900",
  reputacao: "bg-slate-200 text-slate-800",
};

// ── Formatos ────────────────────────────────────────────────────────────────

export const FORMATOS = ["imagem", "video", "carrossel", "story", "texto"] as const;
export type Formato = (typeof FORMATOS)[number];

export const FORMATO_LABEL: Record<Formato, string> = {
  imagem: "Imagem",
  video: "Vídeo",
  carrossel: "Carrossel",
  story: "Story",
  texto: "Texto",
};

/** Formato deduzido dos arquivos escolhidos. */
export function detectarFormato(arquivos: File[]): Formato {
  if (arquivos.length === 0) return "texto";
  if (arquivos.length > 1) return "carrossel";
  const tipo = arquivos[0].type;
  if (tipo.startsWith("video/")) return "video";
  if (tipo.startsWith("image/")) return "imagem";
  return "texto";
}

// ── Status ──────────────────────────────────────────────────────────────────

export const CRIATIVO_STATUS = [
  "rascunho",
  "pendente_aprovacao",
  "aprovado",
  "pedir_ajuste",
  "arquivado",
] as const;
export type CriativoStatus = (typeof CRIATIVO_STATUS)[number];

export const STATUS_LABEL: Record<CriativoStatus, string> = {
  rascunho: "Rascunho",
  pendente_aprovacao: "Pendente aprovação",
  aprovado: "Aprovado",
  pedir_ajuste: "Pedir ajuste",
  arquivado: "Arquivado",
};

export const STATUS_CLASS: Record<CriativoStatus, string> = {
  rascunho: "bg-slate-100 text-slate-600",
  pendente_aprovacao: "bg-amber-100 text-amber-800",
  aprovado: "bg-emerald-100 text-emerald-800",
  pedir_ajuste: "bg-orange-100 text-orange-800",
  arquivado: "bg-slate-100 text-slate-500",
};

// ── Arquivos e histórico ────────────────────────────────────────────────────

export type ArquivoCriativo = { path: string; tipo: string; nome: string };

export function lerArquivos(raw: unknown): ArquivoCriativo[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (a): a is ArquivoCriativo =>
      Boolean(a) && typeof a === "object" && typeof (a as ArquivoCriativo).path === "string",
  );
}

export type EventoHistorico = {
  evento: string;
  por?: string | null;
  em: string;
  texto?: string | null;
};

export function lerHistorico(raw: unknown): EventoHistorico[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is EventoHistorico =>
        Boolean(e) && typeof e === "object" && typeof (e as EventoHistorico).em === "string",
    )
    .sort((a, b) => a.em.localeCompare(b.em));
}

export const EVENTO_LABEL: Record<string, string> = {
  criado: "Criado",
  enviado_aprovacao: "Enviado para aprovação",
  aprovar: "Aprovado",
  pedir_ajuste: "Ajuste pedido",
  rejeitar: "Rejeitado",
  nova_versao: "Nova versão",
  duplicado: "Duplicado",
  arquivado: "Arquivado",
};

export function frasesHistorico(e: EventoHistorico): string {
  const quando = new Date(e.em).toLocaleString("pt-BR");
  const rotulo = EVENTO_LABEL[e.evento] ?? e.evento;
  return e.por ? `${rotulo} por ${e.por} em ${quando}` : `${rotulo} em ${quando}`;
}

// ── Filtros ─────────────────────────────────────────────────────────────────

export const PERIODOS = [
  { valor: "7", label: "Últimos 7 dias" },
  { valor: "30", label: "Últimos 30 dias" },
  { valor: "90", label: "Últimos 90 dias" },
  { valor: "", label: "Todo o período" },
] as const;

export const LIMITE_TITULO = 100;
export const LIMITE_DESCRICAO = 500;
export const LIMITE_LEGENDA = 2200;
