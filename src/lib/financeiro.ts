/**
 * Visão Financeira · tipos, status derivados e formatação.
 *
 * O status "vencida" não existe no banco: é derivado de vencimento < hoje em
 * faturas ainda a_vencer. A mesma regra está nas views (migration
 * 20260903190000_financeiro) — ao mudar aqui, mude lá.
 */

import type { Tables } from "@/integrations/supabase/types";

export type Contrato = Tables<"contratos">;
export type Fatura = Tables<"faturas">;

// ── Contratos ───────────────────────────────────────────────────────────────

export const CONTRATO_STATUS = ["ativo", "pausado", "suspenso", "encerrado"] as const;
export type ContratoStatus = (typeof CONTRATO_STATUS)[number];

export const CONTRATO_STATUS_LABEL: Record<ContratoStatus, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  suspenso: "Suspenso",
  encerrado: "Encerrado",
};

export const CONTRATO_STATUS_CLASS: Record<ContratoStatus, string> = {
  ativo: "bg-emerald-50 text-emerald-700",
  pausado: "bg-amber-50 text-amber-700",
  suspenso: "bg-rose-50 text-rose-700",
  encerrado: "bg-slate-100 text-slate-600",
};

export const PLANOS = ["Essencial", "Crescimento", "Performance", "Enterprise"] as const;

// ── Faturas ─────────────────────────────────────────────────────────────────

export const FATURA_METODOS = ["boleto", "pix", "cartao"] as const;
export type FaturaMetodo = (typeof FATURA_METODOS)[number];

export const METODO_LABEL: Record<FaturaMetodo, string> = {
  boleto: "Boleto",
  pix: "Pix",
  cartao: "Cartão",
};

export const RECORRENCIAS = ["unica", "mensal", "anual"] as const;
export type Recorrencia = (typeof RECORRENCIAS)[number];

export const RECORRENCIA_LABEL: Record<Recorrencia, string> = {
  unica: "Única",
  mensal: "Mensal",
  anual: "Anual",
};

/** Status que a tela mostra — inclui o derivado. */
export const FATURA_STATUS = ["a_vencer", "vencida", "paga", "cancelada"] as const;
export type FaturaStatus = (typeof FATURA_STATUS)[number];

export const FATURA_STATUS_LABEL: Record<FaturaStatus, string> = {
  a_vencer: "A vencer",
  vencida: "Vencida",
  paga: "Paga",
  cancelada: "Cancelada",
};

export const FATURA_STATUS_CLASS: Record<FaturaStatus, string> = {
  a_vencer: "bg-blue-50 text-blue-700",
  vencida: "bg-rose-50 text-rose-700",
  paga: "bg-emerald-50 text-emerald-700",
  cancelada: "bg-slate-100 text-slate-600",
};

function hojeISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Status efetivo: promove a_vencer para vencida quando o prazo passou. */
export function statusFatura(f: Pick<Fatura, "status" | "vencimento">): FaturaStatus {
  if (f.status === "a_vencer" && f.vencimento < hojeISO()) return "vencida";
  return f.status as FaturaStatus;
}

/** Dias corridos de atraso (0 se ainda não venceu). */
export function diasEmAtraso(f: Pick<Fatura, "status" | "vencimento">): number {
  if (statusFatura(f) !== "vencida") return 0;
  const venc = new Date(`${f.vencimento}T00:00:00`);
  const hoje = new Date(`${hojeISO()}T00:00:00`);
  return Math.max(0, Math.round((hoje.getTime() - venc.getTime()) / 86_400_000));
}

/**
 * Rito contratual de inadimplência: notificar a partir de 9 dias, suspender a
 * partir de 30, rescindir a partir de 60.
 */
export type AcaoSugerida = {
  chave: "acompanhar" | "notificar" | "suspender" | "rescindir";
  label: string;
};

export function acaoSugerida(dias: number): AcaoSugerida {
  if (dias >= 60) return { chave: "rescindir", label: "Rescindir" };
  if (dias >= 30) return { chave: "suspender", label: "Suspender (30d)" };
  if (dias >= 9) return { chave: "notificar", label: "Notificar (9d)" };
  return { chave: "acompanhar", label: "Acompanhar" };
}

// ── Formatação ──────────────────────────────────────────────────────────────

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const BRL_CENTAVOS = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function moeda(valor: number | string | null | undefined, comCentavos = false): string {
  const n = Number(valor ?? 0);
  if (!Number.isFinite(n)) return comCentavos ? BRL_CENTAVOS.format(0) : BRL.format(0);
  return comCentavos ? BRL_CENTAVOS.format(n) : BRL.format(n);
}

export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function mesBR(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

/** Próximo vencimento de um contrato ativo, a partir de dia_vencimento. */
export function proximoVencimento(c: Pick<Contrato, "dia_vencimento" | "status">): string | null {
  if (c.status === "encerrado") return null;
  const hoje = new Date();
  const alvo = new Date(hoje.getFullYear(), hoje.getMonth(), c.dia_vencimento);
  if (alvo < hoje) alvo.setMonth(alvo.getMonth() + 1);
  return `${alvo.getFullYear()}-${String(alvo.getMonth() + 1).padStart(2, "0")}-${String(
    alvo.getDate(),
  ).padStart(2, "0")}`;
}

// ── Resumo dos 4 cards ──────────────────────────────────────────────────────

export type FinanceiroResumo = {
  mrr_ativo: number;
  mrr_mes_anterior: number;
  recebido_mes: number;
  previsto_mes: number;
  cobrancas_abertas: number;
  cobrancas_abertas_qtd: number;
  inadimplencia: number;
  inadimplentes_qtd: number;
};

export const RESUMO_VAZIO: FinanceiroResumo = {
  mrr_ativo: 0,
  mrr_mes_anterior: 0,
  recebido_mes: 0,
  previsto_mes: 0,
  cobrancas_abertas: 0,
  cobrancas_abertas_qtd: 0,
  inadimplencia: 0,
  inadimplentes_qtd: 0,
};

/** Variação % do MRR contra o mês anterior. null quando não há base. */
export function variacaoMrr(r: FinanceiroResumo): number | null {
  if (!r.mrr_mes_anterior) return null;
  return ((r.mrr_ativo - r.mrr_mes_anterior) / r.mrr_mes_anterior) * 100;
}

export const FINANCEIRO_TABS = ["contratos", "cobrancas", "mrr", "inadimplencia"] as const;
export type FinanceiroTab = (typeof FINANCEIRO_TABS)[number];

export const FINANCEIRO_TAB_LABEL: Record<FinanceiroTab, string> = {
  contratos: "Contratos",
  cobrancas: "Cobranças",
  mrr: "MRR",
  inadimplencia: "Inadimplência",
};

export function resolveFinanceiroTab(raw: unknown): FinanceiroTab {
  const v = String(raw ?? "");
  return (FINANCEIRO_TABS as readonly string[]).includes(v) ? (v as FinanceiroTab) : "contratos";
}
