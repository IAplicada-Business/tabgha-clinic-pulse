/**
 * Pipeline comercial B2B (Etapa 2 / Fase B) — 8 estágios do Blueprint.
 * Paralelo a src/lib/pipeline.ts (funil de paciente).
 */

export const PIPELINE_B2B = [
  "novo_lead",
  "contato_iniciado",
  "diagnostico_agendado",
  "proposta_enviada",
  "negociacao",
  "cliente_ativo",
  "pos_venda",
  "cliente_promotor",
] as const;

export type PipelineB2bStatus = (typeof PIPELINE_B2B)[number];

export const STATUS_LABELS_B2B: Record<PipelineB2bStatus, string> = {
  novo_lead: "Novo lead",
  contato_iniciado: "Contato iniciado",
  diagnostico_agendado: "Diagnóstico agendado",
  proposta_enviada: "Proposta enviada",
  negociacao: "Negociação",
  cliente_ativo: "Cliente ativo",
  pos_venda: "Pós-venda",
  cliente_promotor: "Cliente promotor",
};

export const COL_STYLES_B2B: Record<
  PipelineB2bStatus,
  { header: string; col: string; badge: string }
> = {
  novo_lead: {
    header: "text-blue-800",
    col: "bg-gradient-to-b from-blue-50/60 to-blue-50/10",
    badge: "bg-blue-100 text-blue-700",
  },
  contato_iniciado: {
    header: "text-amber-800",
    col: "bg-gradient-to-b from-amber-50/60 to-amber-50/10",
    badge: "bg-amber-100 text-amber-700",
  },
  diagnostico_agendado: {
    header: "text-cyan-800",
    col: "bg-gradient-to-b from-cyan-50/60 to-cyan-50/10",
    badge: "bg-cyan-100 text-cyan-700",
  },
  proposta_enviada: {
    header: "text-violet-800",
    col: "bg-gradient-to-b from-violet-50/60 to-violet-50/10",
    badge: "bg-violet-100 text-violet-700",
  },
  negociacao: {
    header: "text-orange-800",
    col: "bg-gradient-to-b from-orange-50/60 to-orange-50/10",
    badge: "bg-orange-100 text-orange-700",
  },
  cliente_ativo: {
    header: "text-green-800",
    col: "bg-gradient-to-b from-green-50/60 to-green-50/10",
    badge: "bg-green-100 text-green-700",
  },
  pos_venda: {
    header: "text-teal-800",
    col: "bg-gradient-to-b from-teal-50/60 to-teal-50/10",
    badge: "bg-teal-100 text-teal-700",
  },
  cliente_promotor: {
    header: "text-emerald-900",
    col: "bg-gradient-to-b from-emerald-50/70 to-emerald-50/10",
    badge: "bg-emerald-100 text-emerald-800",
  },
};

/** Estágios considerados "fechados" para MRR / taxa de fechamento */
export const B2B_WON_STATUSES: readonly PipelineB2bStatus[] = [
  "cliente_ativo",
  "pos_venda",
  "cliente_promotor",
];
