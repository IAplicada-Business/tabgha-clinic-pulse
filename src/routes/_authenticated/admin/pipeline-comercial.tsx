import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { KanbanBoard } from "@/components/crm/KanbanBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createOportunidadeB2b,
  moverOportunidadeB2bStatus,
  updateOportunidadeB2b,
  useKpisPipelineB2b,
  useOportunidadesB2b,
  type OportunidadeB2b,
} from "@/hooks/useOportunidadesB2b";
import { useAuth } from "@/lib/auth";
import {
  COL_STYLES_B2B,
  PIPELINE_B2B,
  STATUS_LABELS_B2B,
  type PipelineB2bStatus,
} from "@/lib/pipeline-b2b";

export const Route = createFileRoute("/_authenticated/admin/pipeline-comercial")({
  component: PipelineComercialPage,
  validateSearch: (search: Record<string, unknown>) => ({
    periodo: Number(search.periodo) || 90,
    canal: typeof search.canal === "string" ? search.canal : "",
    q: typeof search.q === "string" ? search.q : "",
  }),
  head: () => ({ meta: [{ title: "Pipeline comercial B2B · Tabgha OS" }] }),
});

function money(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function PipelineKpiHeader({
  kpis,
}: {
  kpis: {
    total_oportunidades: number;
    fechados: number;
    em_andamento: number;
    taxa_fechamento_pct: number | null;
    mrr: number;
    ticket_medio_b2b: number | null;
  } | null;
}) {
  const cards = [
    { label: "Total no pipeline", value: String(kpis?.total_oportunidades ?? 0) },
    {
      label: "Taxa de fechamento",
      value: kpis?.taxa_fechamento_pct != null ? `${kpis.taxa_fechamento_pct}%` : "—",
    },
    { label: "MRR", value: money(kpis?.mrr) },
    { label: "Ticket médio B2B", value: money(kpis?.ticket_medio_b2b) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl border border-border bg-card px-4 py-4 shadow-sm"
        >
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            {card.label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight">{card.value}</p>
          {card.label.startsWith("Total") ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {kpis?.em_andamento ?? 0} em andamento · {kpis?.fechados ?? 0} fechados
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function OportunidadeDialog({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: OportunidadeB2b | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [email, setEmail] = useState(editing?.email ?? "");
  const [telefone, setTelefone] = useState(editing?.telefone ?? "");
  const [origem, setOrigem] = useState(editing?.origem ?? "");
  const [especialidade, setEspecialidade] = useState(editing?.especialidade ?? "");
  const [cidade, setCidade] = useState(editing?.cidade ?? "");
  const [canal, setCanal] = useState(editing?.canal ?? "indicação");
  const [ticket, setTicket] = useState(editing?.ticket != null ? String(editing.ticket) : "");
  const [roi, setRoi] = useState(editing?.roi != null ? String(editing.roi) : "");
  const [cac, setCac] = useState(editing?.cac != null ? String(editing.cac) : "");
  const [observacoes, setObservacoes] = useState(editing?.observacoes ?? "");
  const [status, setStatus] = useState<PipelineB2bStatus>(
    (editing?.status as PipelineB2bStatus) ?? "novo_lead",
  );

  const mutation = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome da clínica / oportunidade.");
      const payload = {
        nome: nome.trim(),
        email: email.trim() || null,
        telefone: telefone.trim() || null,
        origem: origem.trim() || null,
        especialidade: especialidade.trim() || null,
        cidade: cidade.trim() || null,
        canal: canal.trim() || null,
        ticket: ticket.trim() ? Number(ticket) : null,
        roi: roi.trim() ? Number(roi) : null,
        cac: cac.trim() ? Number(cac) : null,
        observacoes: observacoes.trim() || null,
        status,
        responsavel_id: editing?.responsavel_id ?? user?.id ?? null,
      };
      if (editing) return updateOportunidadeB2b(editing.id, payload);
      return createOportunidadeB2b(payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Oportunidade atualizada" : "Oportunidade criada");
      void qc.invalidateQueries({ queryKey: ["oportunidades-b2b"] });
      void qc.invalidateQueries({ queryKey: ["kpis-pipeline-b2b"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar oportunidade" : "Nova oportunidade B2B"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="space-y-1">
            <Label>Nome / clínica</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Clínica…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Origem</Label>
              <Input
                value={origem}
                onChange={(e) => setOrigem(e.target.value)}
                placeholder="Indicação, outbound…"
              />
            </div>
            <div className="space-y-1">
              <Label>Canal</Label>
              <Input value={canal} onChange={(e) => setCanal(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Especialidade</Label>
              <Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Ticket (MRR)</Label>
              <Input
                type="number"
                step="0.01"
                value={ticket}
                onChange={(e) => setTicket(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>ROI</Label>
              <Input
                type="number"
                step="0.01"
                value={roi}
                onChange={(e) => setRoi(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>CAC</Label>
              <Input
                type="number"
                step="0.01"
                value={cac}
                onChange={(e) => setCac(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Estágio</Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PipelineB2bStatus)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {PIPELINE_B2B.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS_B2B[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Input value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PipelineComercialPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [localSearch, setLocalSearch] = useState(search.q);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<OportunidadeB2b | null>(null);

  const filters = useMemo(
    () => ({
      periodoDias: search.periodo || null,
      canal: search.canal || null,
      search: search.q || "",
    }),
    [search],
  );

  const { data: oportunidades = [], isLoading } = useOportunidadesB2b(filters);
  const { data: kpis } = useKpisPipelineB2b();

  function updateSearch(patch: Partial<typeof search>) {
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, ...patch }),
    });
  }

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col overflow-hidden md:h-screen">
      <div className="shrink-0 border-b border-border px-6 py-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">Pipeline Tabgha · B2B</h1>
          <span className="text-sm text-muted-foreground">{oportunidades.length} no período</span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Funil de clínicas/prospects (paralelo ao funil de pacientes). Acesso: Super Admin e Growth
          Manager.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={search.periodo}
            onChange={(e) => updateSearch({ periodo: Number(e.target.value) })}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={180}>6 meses</option>
            <option value={365}>1 ano</option>
          </select>
          <select
            value={search.canal}
            onChange={(e) => updateSearch({ canal: e.target.value })}
            className="rounded-xl border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Todos os canais</option>
            <option value="indicação">Indicação</option>
            <option value="outbound">Outbound</option>
            <option value="evento">Evento</option>
            <option value="inbound">Inbound</option>
            <option value="manual">Manual</option>
          </select>
          <Input
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            onBlur={() => updateSearch({ q: localSearch })}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateSearch({ q: localSearch });
            }}
            placeholder="Buscar nome, cidade, telefone…"
            className="max-w-xs rounded-xl"
          />
          <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
            <UserPlus className="h-4 w-4" />
            Nova oportunidade
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : oportunidades.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="Nenhuma oportunidade no filtro"
            description="Crie a primeira oportunidade B2B ou ajuste o período."
            action={{ label: "Nova oportunidade", onClick: () => setShowCreate(true) }}
          />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 px-6 py-4">
          <div className="shrink-0">
            <PipelineKpiHeader kpis={kpis ?? null} />
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <p className="mb-3 shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Pipeline B2B
            </p>
            <div className="min-h-0 flex-1">
              <KanbanBoard
                leads={oportunidades}
                stages={PIPELINE_B2B}
                statusLabels={STATUS_LABELS_B2B}
                colStyles={COL_STYLES_B2B}
                requireMotivoOnStatus={null}
                enableLeadDetail={false}
                emptyColumnHint="Arraste uma oportunidade aqui"
                movedToast="Oportunidade movida"
                invalidateKeys={[["oportunidades-b2b"], ["kpis-pipeline-b2b"]]}
                onMoveStatus={async (id, novo) => {
                  await moverOportunidadeB2bStatus(id, novo as PipelineB2bStatus);
                }}
                onCardOpen={(card) => {
                  const full = oportunidades.find((o) => o.id === card.id);
                  if (full) setEditing(full);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showCreate ? (
        <OportunidadeDialog key="create" open editing={null} onClose={() => setShowCreate(false)} />
      ) : null}
      {editing ? (
        <OportunidadeDialog
          key={editing.id}
          open
          editing={editing}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}
