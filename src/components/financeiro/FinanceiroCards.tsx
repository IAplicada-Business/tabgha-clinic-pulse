import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { hasPermission, ADMIN_PERMISSION_GROUPS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { RESUMO_VAZIO, moeda, variacaoMrr, type FinanceiroResumo } from "@/lib/financeiro";

/**
 * Os 4 cards financeiros do topo do dashboard admin.
 * Só aparecem para quem tem admin.financeiro na matriz de perfis
 * (super_admin, gestor_estrategico e financeiro).
 */
export function FinanceiroCards() {
  const { profile } = useAuth();
  const podeVer = hasPermission(profile?.permissoes, ADMIN_PERMISSION_GROUPS.financeiro);

  const { data: resumo = RESUMO_VAZIO, isLoading } = useQuery<FinanceiroResumo>({
    queryKey: ["admin", "financeiro", "resumo"],
    enabled: podeVer,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_financeiro_resumo").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return RESUMO_VAZIO;
      return Object.fromEntries(
        Object.keys(RESUMO_VAZIO).map((k) => [
          k,
          Number((data as Record<string, unknown>)[k] ?? 0),
        ]),
      ) as FinanceiroResumo;
    },
  });

  if (!podeVer || isLoading) return null;

  const variacao = variacaoMrr(resumo);
  const progresso = resumo.previsto_mes
    ? Math.min(100, (resumo.recebido_mes / resumo.previsto_mes) * 100)
    : 0;
  const temInadimplencia = resumo.inadimplencia > 0;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1 · MRR ativo */}
      <CardFinanceiro
        to="/admin/financeiro"
        search={{ tab: "mrr" as const, status: "", periodo: "" }}
        label="MRR ativo"
        icone={<TrendingUp className="h-4 w-4" />}
        tom="azul"
      >
        <p className="text-2xl font-extrabold tabular-nums tracking-tight">
          {moeda(resumo.mrr_ativo)}
        </p>
        {variacao === null ? (
          <p className="mt-1 text-[11px] text-muted-foreground">Sem base do mês anterior</p>
        ) : (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-[11px] font-semibold",
              variacao >= 0 ? "text-emerald-700" : "text-rose-700",
            )}
          >
            {variacao >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {`${variacao >= 0 ? "+" : ""}${variacao.toFixed(1)}% vs. mês anterior`}
          </p>
        )}
      </CardFinanceiro>

      {/* 2 · Recebido no mês */}
      <CardFinanceiro
        to="/admin/financeiro"
        search={{ tab: "cobrancas" as const, status: "", periodo: "mes-corrente" }}
        label="Recebido no mês"
        icone={<Wallet className="h-4 w-4" />}
        tom="verde"
      >
        <p className="text-2xl font-extrabold tabular-nums tracking-tight">
          {moeda(resumo.recebido_mes)}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${progresso}%` }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {progresso.toFixed(0)}% de {moeda(resumo.previsto_mes)} previstos
        </p>
      </CardFinanceiro>

      {/* 3 · Cobranças em aberto */}
      <CardFinanceiro
        to="/admin/financeiro"
        search={{ tab: "cobrancas" as const, status: "abertas", periodo: "" }}
        label="Cobranças em aberto"
        icone={<FileText className="h-4 w-4" />}
        tom="azul"
      >
        <p className="text-2xl font-extrabold tabular-nums tracking-tight">
          {moeda(resumo.cobrancas_abertas)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {resumo.cobrancas_abertas_qtd} fatura{resumo.cobrancas_abertas_qtd === 1 ? "" : "s"}{" "}
          pendente{resumo.cobrancas_abertas_qtd === 1 ? "" : "s"}
        </p>
      </CardFinanceiro>

      {/* 4 · Inadimplência */}
      <CardFinanceiro
        to="/admin/financeiro"
        search={{ tab: "inadimplencia" as const, status: "", periodo: "" }}
        label="Inadimplência"
        icone={<AlertTriangle className="h-4 w-4" />}
        tom={temInadimplencia ? "vermelho" : "neutro"}
      >
        <p
          className={cn(
            "text-2xl font-extrabold tabular-nums tracking-tight",
            temInadimplencia && "text-rose-700",
          )}
        >
          {moeda(resumo.inadimplencia)}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {resumo.inadimplentes_qtd} cliente{resumo.inadimplentes_qtd === 1 ? "" : "s"} inadimplente
          {resumo.inadimplentes_qtd === 1 ? "" : "s"}
        </p>
      </CardFinanceiro>
    </div>
  );
}

const TOM_CLASS = {
  azul: "border-border bg-card",
  verde: "border-border bg-card",
  vermelho: "border-rose-200 bg-rose-50/60",
  neutro: "border-border bg-card",
} as const;

const ICONE_CLASS = {
  azul: "bg-blue-50 text-blue-700",
  verde: "bg-emerald-50 text-emerald-700",
  vermelho: "bg-rose-100 text-rose-700",
  neutro: "bg-slate-100 text-slate-600",
} as const;

function CardFinanceiro({
  to,
  search,
  label,
  icone,
  tom,
  children,
}: {
  to: "/admin/financeiro";
  search: {
    tab: "contratos" | "cobrancas" | "mrr" | "inadimplencia";
    status: string;
    periodo: string;
  };
  label: string;
  icone: React.ReactNode;
  tom: keyof typeof TOM_CLASS;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      search={search}
      className={cn(
        "rounded-2xl border p-4 shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-lift)]",
        TOM_CLASS[tom],
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn("flex h-7 w-7 items-center justify-center rounded-lg", ICONE_CLASS[tom])}
        >
          {icone}
        </span>
        <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
      </div>
      <div className="mt-2.5">{children}</div>
    </Link>
  );
}
