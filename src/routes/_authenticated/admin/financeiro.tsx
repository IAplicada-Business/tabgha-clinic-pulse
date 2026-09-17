import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Ban,
  Bell,
  Check,
  DollarSign,
  Loader2,
  Play,
  Plus,
  Send,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { KpiCard } from "@/components/ui/kpi-card";
import { CHART_TOOLTIP_STYLE, CHART_TOOLTIP_CURSOR } from "@/components/analytics/InsightPanel";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { cn } from "@/lib/utils";
import {
  CONTRATO_STATUS,
  CONTRATO_STATUS_CLASS,
  CONTRATO_STATUS_LABEL,
  FATURA_METODOS,
  FATURA_STATUS,
  FATURA_STATUS_CLASS,
  FATURA_STATUS_LABEL,
  FINANCEIRO_TABS,
  FINANCEIRO_TAB_LABEL,
  METODO_LABEL,
  PLANOS,
  RECORRENCIAS,
  RECORRENCIA_LABEL,
  acaoSugerida,
  dataBR,
  diasEmAtraso,
  mesBR,
  moeda,
  proximoVencimento,
  resolveFinanceiroTab,
  statusFatura,
  type Contrato,
  type ContratoStatus,
  type Fatura,
} from "@/lib/financeiro";

export const Route = createFileRoute("/_authenticated/admin/financeiro")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: resolveFinanceiroTab(search.tab),
    status: typeof search.status === "string" ? search.status : "",
    periodo: typeof search.periodo === "string" ? search.periodo : "",
  }),
  component: FinanceiroPage,
  head: () => ({ meta: [{ title: "Financeiro · Tabgha OS" }] }),
});

type ContratoComCliente = Contrato & { cliente_nome: string };
type FaturaComCliente = Fatura & { cliente_nome: string };

const TITULO: Record<string, string> = {
  contratos: "Contratos",
  cobrancas: "Cobranças",
  mrr: "Evolução do MRR",
  inadimplencia: "Inadimplência",
};

function FinanceiroPage() {
  const { tab, status: statusInicial, periodo } = Route.useSearch();
  const navigate = useNavigate();

  const { data: clientes = [] } = useClientesOptions();
  const nomePorCliente = useMemo(() => new Map(clientes.map((c) => [c.id, c.nome])), [clientes]);

  const { data: contratosRaw = [], isLoading: carregandoContratos } = useQuery<Contrato[]>({
    queryKey: ["admin", "financeiro", "contratos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contratos")
        .select("*")
        .order("atualizado_em", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as Contrato[];
    },
  });

  const { data: faturasRaw = [], isLoading: carregandoFaturas } = useQuery<Fatura[]>({
    queryKey: ["admin", "financeiro", "faturas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("faturas")
        .select("*")
        .order("vencimento", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return (data ?? []) as Fatura[];
    },
  });

  const contratos: ContratoComCliente[] = useMemo(
    () =>
      contratosRaw.map((c) => ({
        ...c,
        cliente_nome: nomePorCliente.get(c.cliente_id) ?? "Cliente removido",
      })),
    [contratosRaw, nomePorCliente],
  );

  const faturas: FaturaComCliente[] = useMemo(
    () =>
      faturasRaw.map((f) => ({
        ...f,
        cliente_nome: nomePorCliente.get(f.cliente_id) ?? "Cliente removido",
      })),
    [faturasRaw, nomePorCliente],
  );

  const carregando = carregandoContratos || carregandoFaturas;

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="animate-fade-up">
        <span className="eyebrow-pill">Financeiro</span>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          <DollarSign className="h-6 w-6 text-emerald-700" />
          {TITULO[tab]}
        </h1>
      </div>

      <div className="segmented animate-fade-up w-full sm:w-fit" style={{ animationDelay: "75ms" }}>
        {FINANCEIRO_TABS.map((t) => (
          <button
            key={t}
            type="button"
            data-active={tab === t ? "true" : undefined}
            onClick={() =>
              void navigate({
                to: "/admin/financeiro",
                search: { tab: t, status: "", periodo: "" },
              })
            }
            className="segmented-item"
          >
            {FINANCEIRO_TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="flex justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "contratos" ? (
        <AbaContratos contratos={contratos} faturas={faturas} />
      ) : tab === "cobrancas" ? (
        <AbaCobrancas
          faturas={faturas}
          contratos={contratos}
          statusInicial={statusInicial}
          periodo={periodo}
        />
      ) : tab === "mrr" ? (
        <AbaMrr contratos={contratos} />
      ) : (
        <AbaInadimplencia faturas={faturas} contratos={contratos} />
      )}
    </div>
  );
}

// ── Aba Contratos ───────────────────────────────────────────────────────────

function AbaContratos({
  contratos,
  faturas,
}: {
  contratos: ContratoComCliente[];
  faturas: FaturaComCliente[];
}) {
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroPlano, setFiltroPlano] = useState("");
  const [novo, setNovo] = useState(false);
  const [detalhe, setDetalhe] = useState<ContratoComCliente | null>(null);

  const lista = contratos.filter(
    (c) =>
      (!filtroStatus || c.status === filtroStatus) &&
      (!filtroCliente || c.cliente_id === filtroCliente) &&
      (!filtroPlano || c.plano === filtroPlano),
  );

  const clientesDosContratos = [
    ...new Map(contratos.map((c) => [c.cliente_id, c.cliente_nome])).entries(),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FiltroSelect
            label="Status"
            value={filtroStatus}
            onChange={setFiltroStatus}
            opcoes={CONTRATO_STATUS.map((s) => ({ value: s, label: CONTRATO_STATUS_LABEL[s] }))}
          />
          <FiltroSelect
            label="Cliente"
            value={filtroCliente}
            onChange={setFiltroCliente}
            opcoes={clientesDosContratos.map(([id, nome]) => ({ value: id, label: nome }))}
          />
          <FiltroSelect
            label="Plano"
            value={filtroPlano}
            onChange={setFiltroPlano}
            opcoes={PLANOS.map((p) => ({ value: p, label: p }))}
          />
        </div>
        <Button className="gap-2" onClick={() => setNovo(true)}>
          <Plus className="h-4 w-4" />
          Novo contrato
        </Button>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="h-6 w-6" />}
          title="Nenhum contrato"
          description="Cadastre o primeiro contrato para o MRR começar a ser calculado."
          action={{ label: "Novo contrato", onClick: () => setNovo(true) }}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3 text-right">Valor mensal</th>
                <th className="px-4 py-3">Assinatura</th>
                <th className="px-4 py-3">Vigência</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Próx. vencimento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => setDetalhe(c)}
                  className="cursor-pointer transition-colors hover:bg-secondary/30"
                >
                  <td className="px-4 py-3 font-medium">{c.cliente_nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.plano}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">
                    {moeda(c.valor_mensal)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{dataBR(c.data_assinatura)}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {dataBR(c.vigencia_inicio)} →{" "}
                    {c.vigencia_fim ? dataBR(c.vigencia_fim) : "sem fim"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        CONTRATO_STATUS_CLASS[c.status as ContratoStatus],
                      )}
                    >
                      {CONTRATO_STATUS_LABEL[c.status as ContratoStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {dataBR(proximoVencimento(c))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {novo ? <DialogContrato onClose={() => setNovo(false)} /> : null}
      {detalhe ? (
        <DialogDetalheContrato
          contrato={detalhe}
          faturas={faturas.filter((f) => f.contrato_id === detalhe.id)}
          onClose={() => setDetalhe(null)}
        />
      ) : null}
    </div>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  opcoes,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  opcoes: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[10.5px] uppercase tracking-widest text-muted-foreground">
        {label}
      </Label>
      <Select value={value || "__todos"} onValueChange={(v) => onChange(v === "__todos" ? "" : v)}>
        <SelectTrigger className="h-8 w-[170px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__todos">Todos</SelectItem>
          {opcoes.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DialogContrato({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data: clientes = [] } = useClientesOptions();
  const [clienteId, setClienteId] = useState("");
  const [plano, setPlano] = useState<string>(PLANOS[0]);
  const [valor, setValor] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("10");
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [fim, setFim] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contratos").insert({
        cliente_id: clienteId,
        plano,
        valor_mensal: Number(valor) || 0,
        data_assinatura: inicio,
        vigencia_inicio: inicio,
        vigencia_fim: fim || null,
        dia_vencimento: Math.max(1, Math.min(28, Number(diaVencimento) || 10)),
        observacoes: observacoes.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Contrato criado.");
      void qc.invalidateQueries({ queryKey: ["admin", "financeiro"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo contrato</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolha o cliente" />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Plano</Label>
              <Select value={plano} onValueChange={setPlano}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANOS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="valor-mensal">Valor mensal (R$)</Label>
              <Input
                id="valor-mensal"
                type="number"
                min={0}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="3500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="inicio">Início</Label>
              <Input
                id="inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fim">Fim (opcional)</Label>
              <Input id="fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dia-venc">Dia venc.</Label>
              <Input
                id="dia-venc"
                type="number"
                min={1}
                max={28}
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs-contrato">Cláusulas resumidas</Label>
            <Textarea
              id="obs-contrato"
              rows={4}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Escopo, prazo de aviso prévio, reajuste, multa…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!clienteId || !valor || salvar.isPending}
            onClick={() => salvar.mutate()}
            className="gap-2"
          >
            {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar contrato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DialogDetalheContrato({
  contrato,
  faturas,
  onClose,
}: {
  contrato: ContratoComCliente;
  faturas: FaturaComCliente[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [renegociando, setRenegociando] = useState(false);
  const [novoValor, setNovoValor] = useState(String(contrato.valor_mensal));
  const [cobrancaExtra, setCobrancaExtra] = useState(false);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["admin", "financeiro"] });

  const renegociar = useMutation({
    mutationFn: async () => {
      const historico = ((contrato.metadados as Record<string, unknown>)?.renegociacoes ??
        []) as Array<Record<string, unknown>>;
      const { error } = await supabase
        .from("contratos")
        .update({
          valor_mensal: Number(novoValor) || 0,
          metadados: {
            ...((contrato.metadados as Record<string, unknown>) ?? {}),
            renegociacoes: [
              ...historico,
              {
                de: Number(contrato.valor_mensal),
                para: Number(novoValor) || 0,
                em: new Date().toISOString(),
              },
            ] as unknown[],
          } as never,
        })
        .eq("id", contrato.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Valor renegociado.");
      void invalidar();
      setRenegociando(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const mudarStatus = useMutation({
    mutationFn: async (novo: ContratoStatus) => {
      if (novo === "suspenso") {
        const { error } = await supabase.rpc("suspender_contrato", { _contrato_id: contrato.id });
        if (error) throw new Error(error.message);
        return;
      }
      if (novo === "ativo" && contrato.status === "suspenso") {
        const { error } = await supabase.rpc("reativar_contrato", { _contrato_id: contrato.id });
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase
        .from("contratos")
        .update({
          status: novo,
          vigencia_fim:
            novo === "encerrado" ? new Date().toISOString().slice(0, 10) : contrato.vigencia_fim,
        })
        .eq("id", contrato.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Contrato atualizado.");
      void invalidar();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renegociacoes = ((contrato.metadados as Record<string, unknown>)?.renegociacoes ??
    []) as Array<{ de: number; para: number; em: string }>;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {contrato.cliente_nome}
            <span className="text-sm font-normal text-muted-foreground">· {contrato.plano}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                CONTRATO_STATUS_CLASS[contrato.status as ContratoStatus],
              )}
            >
              {CONTRATO_STATUS_LABEL[contrato.status as ContratoStatus]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Info label="Valor mensal" valor={moeda(contrato.valor_mensal)} />
          <Info label="Assinatura" valor={dataBR(contrato.data_assinatura)} />
          <Info
            label="Vigência"
            valor={`${dataBR(contrato.vigencia_inicio)} → ${contrato.vigencia_fim ? dataBR(contrato.vigencia_fim) : "sem fim"}`}
          />
          <Info label="Dia de vencimento" valor={String(contrato.dia_vencimento)} />
        </div>

        {contrato.observacoes ? (
          <div className="rounded-xl border border-border bg-secondary/30 p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Cláusulas resumidas
            </p>
            <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed">
              {contrato.observacoes}
            </p>
          </div>
        ) : null}

        <div>
          <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
            Timeline de pagamentos
          </p>
          {faturas.length === 0 ? (
            <p className="rounded-xl border border-border bg-secondary/20 px-4 py-6 text-center text-xs text-muted-foreground">
              Nenhuma fatura emitida para este contrato.
            </p>
          ) : (
            <div className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
              {faturas.map((f) => {
                const st = statusFatura(f);
                return (
                  <div key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                      {dataBR(f.vencimento)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{f.descricao}</span>
                    <span className="shrink-0 font-semibold tabular-nums">
                      {moeda(f.valor, true)}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
                        FATURA_STATUS_CLASS[st],
                      )}
                    >
                      {FATURA_STATUS_LABEL[st]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {renegociacoes.length > 0 ? (
          <div className="rounded-xl border border-border bg-secondary/20 p-3">
            <p className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Histórico de renegociação
            </p>
            <ul className="mt-1.5 space-y-0.5 text-[11.5px] text-muted-foreground">
              {renegociacoes.map((r, i) => (
                <li key={i}>
                  {new Date(r.em).toLocaleDateString("pt-BR")} · {moeda(r.de)} → {moeda(r.para)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {renegociando ? (
          <div className="flex items-end gap-2 rounded-xl border border-border bg-secondary/30 p-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="novo-valor">Novo valor mensal (R$)</Label>
              <Input
                id="novo-valor"
                type="number"
                min={0}
                value={novoValor}
                onChange={(e) => setNovoValor(e.target.value)}
              />
            </div>
            <Button size="sm" disabled={renegociar.isPending} onClick={() => renegociar.mutate()}>
              Salvar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRenegociando(false)}>
              Cancelar
            </Button>
          </div>
        ) : null}

        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setCobrancaExtra(true)}>
            Emitir cobrança extra
          </Button>
          <Button variant="outline" size="sm" onClick={() => setRenegociando(true)}>
            Renegociar
          </Button>
          {contrato.status === "suspenso" ? (
            <Button size="sm" className="gap-1.5" onClick={() => mudarStatus.mutate("ativo")}>
              <Play className="h-3.5 w-3.5" />
              Reativar
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
              onClick={() => mudarStatus.mutate("encerrado")}
              disabled={contrato.status === "encerrado"}
            >
              <Ban className="h-3.5 w-3.5" />
              Encerrar contrato
            </Button>
          )}
        </DialogFooter>

        {cobrancaExtra ? (
          <DialogCobranca contrato={contrato} onClose={() => setCobrancaExtra(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold">{valor}</p>
    </div>
  );
}

// ── Aba Cobranças ───────────────────────────────────────────────────────────

function AbaCobrancas({
  faturas,
  contratos,
  statusInicial,
  periodo,
}: {
  faturas: FaturaComCliente[];
  contratos: ContratoComCliente[];
  statusInicial: string;
  periodo: string;
}) {
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState(
    statusInicial === "abertas" ? "a_vencer" : statusInicial,
  );
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("");
  const [nova, setNova] = useState(false);

  const inicioMes = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }, []);

  const lista = faturas.filter((f) => {
    const st = statusFatura(f);
    if (filtroStatus === "abertas" ? st === "paga" || st === "cancelada" : false) return false;
    if (filtroStatus && filtroStatus !== "abertas" && st !== filtroStatus) return false;
    if (filtroCliente && f.cliente_id !== filtroCliente) return false;
    if (filtroMetodo && f.metodo !== filtroMetodo) return false;
    if (periodo === "mes-corrente" && f.vencimento < inicioMes) return false;
    return true;
  });

  const clientesDasFaturas = [
    ...new Map(faturas.map((f) => [f.cliente_id, f.cliente_nome])).entries(),
  ];

  const acao = useMutation({
    mutationFn: async ({ id, tipo }: { id: string; tipo: "paga" | "cancelar" | "reenviar" }) => {
      if (tipo === "paga") {
        const { error } = await supabase.rpc("marcar_fatura_paga", { _id: id });
        if (error) throw new Error(error.message);
        return;
      }
      if (tipo === "cancelar") {
        const { error } = await supabase
          .from("faturas")
          .update({ status: "cancelada" })
          .eq("id", id);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase
        .from("faturas")
        .update({ notificada_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_d, vars) => {
      toast.success(
        vars.tipo === "paga"
          ? "Fatura marcada como paga."
          : vars.tipo === "cancelar"
            ? "Fatura cancelada."
            : "Cobrança marcada como reenviada.",
      );
      void qc.invalidateQueries({ queryKey: ["admin", "financeiro"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <FiltroSelect
            label="Status"
            value={filtroStatus}
            onChange={setFiltroStatus}
            opcoes={FATURA_STATUS.map((s) => ({ value: s, label: FATURA_STATUS_LABEL[s] }))}
          />
          <FiltroSelect
            label="Cliente"
            value={filtroCliente}
            onChange={setFiltroCliente}
            opcoes={clientesDasFaturas.map(([id, nome]) => ({ value: id, label: nome }))}
          />
          <FiltroSelect
            label="Método"
            value={filtroMetodo}
            onChange={setFiltroMetodo}
            opcoes={FATURA_METODOS.map((m) => ({ value: m, label: METODO_LABEL[m] }))}
          />
        </div>
        <Button className="gap-2" onClick={() => setNova(true)}>
          <Plus className="h-4 w-4" />
          Nova cobrança
        </Button>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<DollarSign className="h-6 w-6" />}
          title="Nenhuma cobrança"
          description="Emita a primeira cobrança para acompanhar o recebido do mês."
          action={{ label: "Nova cobrança", onClick: () => setNova(true) }}
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Descrição</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3">Vencimento</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Link</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lista.map((f) => {
                const st = statusFatura(f);
                const encerrada = st === "paga" || st === "cancelada";
                return (
                  <tr key={f.id} className="transition-colors hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">{f.cliente_nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.descricao}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">
                      {moeda(f.valor, true)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {dataBR(f.vencimento)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          FATURA_STATUS_CLASS[st],
                        )}
                      >
                        {FATURA_STATUS_LABEL[st]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {METODO_LABEL[f.metodo as keyof typeof METODO_LABEL] ?? f.metodo}
                    </td>
                    <td className="px-4 py-3">
                      {f.link_pagamento ? (
                        <a
                          href={f.link_pagamento}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline-offset-2 hover:text-[var(--accent-orange)] hover:underline"
                        >
                          abrir
                        </a>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Reenviar cobrança"
                          disabled={encerrada || acao.isPending}
                          onClick={() => acao.mutate({ id: f.id, tipo: "reenviar" })}
                        >
                          <Send className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Marcar como paga"
                          disabled={encerrada || acao.isPending}
                          onClick={() => acao.mutate({ id: f.id, tipo: "paga" })}
                        >
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Cancelar"
                          disabled={encerrada || acao.isPending}
                          onClick={() => acao.mutate({ id: f.id, tipo: "cancelar" })}
                        >
                          <Ban className="h-3.5 w-3.5 text-rose-600" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {nova ? <DialogCobranca contratos={contratos} onClose={() => setNova(false)} /> : null}
    </div>
  );
}

function DialogCobranca({
  contrato,
  contratos,
  onClose,
}: {
  contrato?: ContratoComCliente;
  contratos?: ContratoComCliente[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: clientes = [] } = useClientesOptions();
  const [clienteId, setClienteId] = useState(contrato?.cliente_id ?? "");
  const [descricao, setDescricao] = useState(contrato ? "Cobrança extra" : "Mensalidade");
  const [valor, setValor] = useState(contrato ? "" : "");
  const [vencimento, setVencimento] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [metodo, setMetodo] = useState<string>("pix");
  const [recorrencia, setRecorrencia] = useState<string>(contrato ? "unica" : "mensal");
  const [link, setLink] = useState("");

  const contratoDoCliente =
    contrato ?? contratos?.find((c) => c.cliente_id === clienteId && c.status === "ativo");

  const salvar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("faturas").insert({
        cliente_id: clienteId,
        contrato_id: contratoDoCliente?.id ?? null,
        descricao: descricao.trim() || "Cobrança",
        valor: Number(valor) || 0,
        vencimento,
        metodo,
        recorrencia,
        link_pagamento: link.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Cobrança criada.");
      void qc.invalidateQueries({ queryKey: ["admin", "financeiro"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{contrato ? "Cobrança extra" : "Nova cobrança"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {contrato ? (
            <p className="rounded-lg bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
              {contrato.cliente_nome} · contrato {contrato.plano}
            </p>
          ) : (
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="desc-cobranca">Descrição</Label>
            <Input
              id="desc-cobranca"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="valor-cobranca">Valor (R$)</Label>
              <Input
                id="valor-cobranca"
                type="number"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="venc-cobranca">Vencimento</Label>
              <Input
                id="venc-cobranca"
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Método</Label>
              <Select value={metodo} onValueChange={setMetodo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FATURA_METODOS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {METODO_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Recorrência</Label>
              <Select value={recorrencia} onValueChange={setRecorrencia}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECORRENCIAS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {RECORRENCIA_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="link-cobranca">Link de pagamento (opcional)</Label>
            <Input
              id="link-cobranca"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!clienteId || !valor || salvar.isPending}
            onClick={() => salvar.mutate()}
            className="gap-2"
          >
            {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Criar cobrança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Aba MRR ─────────────────────────────────────────────────────────────────

const MRR_COLOR = "#2B6CB0";

function AbaMrr({ contratos }: { contratos: ContratoComCliente[] }) {
  const { data: linhas = [], isLoading } = useQuery({
    queryKey: ["admin", "financeiro", "mrr"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vw_mrr_mensal").select("*");
      if (error) throw new Error(error.message);
      return (data ?? []) as Array<{
        mes: string | null;
        mrr: number | null;
        novo: number | null;
        churn: number | null;
      }>;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dados = linhas
    .filter((l) => l.mes)
    .map((l) => ({
      mes: mesBR(l.mes!),
      mrr: Number(l.mrr ?? 0),
      novo: Number(l.novo ?? 0),
      churn: Number(l.churn ?? 0),
    }));

  const atual = dados.at(-1);
  const anterior = dados.at(-2);
  const expansao = Math.max(0, (atual?.mrr ?? 0) - (anterior?.mrr ?? 0) - (atual?.novo ?? 0));
  const contracao = Math.max(0, (anterior?.mrr ?? 0) - (atual?.mrr ?? 0) - (atual?.churn ?? 0));

  const ativos = contratos.filter((c) => c.status === "ativo").length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="mb-1 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
          MRR · últimos 12 meses
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dados} margin={{ top: 12, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: "#94a3b8" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => moeda(v)}
                width={78}
              />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                cursor={CHART_TOOLTIP_CURSOR}
                formatter={(v: number) => moeda(v, true)}
              />
              <Line
                type="monotone"
                dataKey="mrr"
                stroke={MRR_COLOR}
                strokeWidth={2}
                dot={{ r: 3, fill: MRR_COLOR }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard
          label="MRR atual"
          value={atual?.mrr ?? 0}
          icon={DollarSign}
          tint="blue"
          format="currency"
        />
        <KpiCard
          label="Novo MRR (mês)"
          value={atual?.novo ?? 0}
          icon={Plus}
          tint="green"
          format="currency"
        />
        <KpiCard label="Expansão" value={expansao} icon={Plus} tint="sky" format="currency" />
        <KpiCard
          label="Contração"
          value={contracao}
          icon={AlertTriangle}
          tint="amber"
          format="currency"
        />
        <KpiCard
          label="Churn (mês)"
          value={atual?.churn ?? 0}
          icon={Ban}
          tint="rose"
          format="currency"
        />
      </div>

      <p className="text-[11px] text-muted-foreground">
        {ativos} contrato(s) ativo(s). Expansão e contração são a diferença do MRR contra o mês
        anterior depois de descontar entradas novas e churn.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3">Mês</th>
              <th className="px-4 py-3 text-right">MRR início</th>
              <th className="px-4 py-3 text-right">Novo</th>
              <th className="px-4 py-3 text-right">Churn</th>
              <th className="px-4 py-3 text-right">MRR fim</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {dados.map((l, i) => (
              <tr key={l.mes} className="transition-colors hover:bg-secondary/30">
                <td className="px-4 py-2.5 font-medium capitalize">{l.mes}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {moeda(dados[i - 1]?.mrr ?? 0)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                  {l.novo ? `+${moeda(l.novo)}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">
                  {l.churn ? `−${moeda(l.churn)}` : "—"}
                </td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                  {moeda(l.mrr)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Aba Inadimplência ───────────────────────────────────────────────────────

function AbaInadimplencia({
  faturas,
  contratos,
}: {
  faturas: FaturaComCliente[];
  contratos: ContratoComCliente[];
}) {
  const qc = useQueryClient();

  const porCliente = useMemo(() => {
    const vencidas = faturas.filter((f) => statusFatura(f) === "vencida");
    const mapa = new Map<
      string,
      {
        clienteId: string;
        nome: string;
        devido: number;
        dias: number;
        primeira: string;
        ultimaNotificacao: string | null;
      }
    >();
    for (const f of vencidas) {
      const atual = mapa.get(f.cliente_id);
      const dias = diasEmAtraso(f);
      if (!atual) {
        mapa.set(f.cliente_id, {
          clienteId: f.cliente_id,
          nome: f.cliente_nome,
          devido: Number(f.valor),
          dias,
          primeira: f.vencimento,
          ultimaNotificacao: f.notificada_em,
        });
      } else {
        atual.devido += Number(f.valor);
        atual.dias = Math.max(atual.dias, dias);
        if (f.vencimento < atual.primeira) atual.primeira = f.vencimento;
        if (
          f.notificada_em &&
          (!atual.ultimaNotificacao || f.notificada_em > atual.ultimaNotificacao)
        ) {
          atual.ultimaNotificacao = f.notificada_em;
        }
      }
    }
    return [...mapa.values()].sort((a, b) => b.dias - a.dias);
  }, [faturas]);

  const notificar = useMutation({
    mutationFn: async (clienteId: string) => {
      const ids = faturas
        .filter((f) => f.cliente_id === clienteId && statusFatura(f) === "vencida")
        .map((f) => f.id);
      const { error } = await supabase
        .from("faturas")
        .update({ notificada_em: new Date().toISOString() })
        .in("id", ids);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Notificação formal registrada.");
      void qc.invalidateQueries({ queryKey: ["admin", "financeiro"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const suspender = useMutation({
    mutationFn: async (clienteId: string) => {
      const contrato = contratos.find(
        (c) => c.cliente_id === clienteId && c.status !== "encerrado",
      );
      if (!contrato) throw new Error("Este cliente não tem contrato ativo para suspender.");
      const { error } = await supabase.rpc("suspender_contrato", {
        _contrato_id: contrato.id,
        _motivo: "inadimplência",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Contrato suspenso e acesso do cliente bloqueado.");
      void qc.invalidateQueries({ queryKey: ["admin", "financeiro"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (porCliente.length === 0) {
    return (
      <EmptyState
        icon={<Check className="h-6 w-6" />}
        title="Nenhum cliente inadimplente"
        description="Todas as faturas emitidas estão em dia."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50/50 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
        <p className="text-xs leading-relaxed text-rose-900">
          Rito contratual: notificação formal a partir de 9 dias, suspensão a partir de 30 e
          rescisão a partir de 60. Suspender bloqueia o acesso do cliente à plataforma.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3 text-right">Valor devido</th>
              <th className="px-4 py-3 text-right">Dias em atraso</th>
              <th className="px-4 py-3">Primeira cobrança</th>
              <th className="px-4 py-3">Última notificação</th>
              <th className="px-4 py-3">Ação sugerida</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {porCliente.map((c) => {
              const acao = acaoSugerida(c.dias);
              return (
                <tr key={c.clienteId} className="transition-colors hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{c.nome}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-rose-700">
                    {moeda(c.devido, true)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{c.dias}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {dataBR(c.primeira)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {c.ultimaNotificacao
                      ? new Date(c.ultimaNotificacao).toLocaleDateString("pt-BR")
                      : "Nunca"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        acao.chave === "rescindir"
                          ? "bg-rose-100 text-rose-800"
                          : acao.chave === "suspender"
                            ? "bg-amber-100 text-amber-800"
                            : acao.chave === "notificar"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-slate-100 text-slate-600",
                      )}
                    >
                      {acao.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 text-[11px]"
                        disabled={notificar.isPending}
                        onClick={() => notificar.mutate(c.clienteId)}
                      >
                        <Bell className="h-3 w-3" />
                        Notificar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1.5 border-rose-200 text-[11px] text-rose-700 hover:bg-rose-50"
                        disabled={suspender.isPending || c.dias < 30}
                        title={c.dias < 30 ? "Rito prevê suspensão a partir de 30 dias" : undefined}
                        onClick={() => suspender.mutate(c.clienteId)}
                      >
                        <Ban className="h-3 w-3" />
                        Suspender
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        "Notificar" registra a notificação formal nas faturas vencidas do cliente. O disparo
        automático por e-mail e WhatsApp entra quando o provedor de e-mail estiver configurado — o
        template já existe em supabase/functions/_shared/email_tabgha.ts.
      </p>
    </div>
  );
}
