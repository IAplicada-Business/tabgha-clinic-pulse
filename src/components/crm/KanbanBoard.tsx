import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, GripVertical, Layers, Loader2, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { LeadDetailDialog } from "@/components/crm/LeadDetailDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KpiCard } from "@/components/ui/kpi-card";
import { moverLeadStatus, type Lead } from "@/hooks/useLeads";
import {
  CANAL_COLORS,
  COL_STYLES,
  MOTIVO_LABELS,
  PIPELINE,
  STATUS_LABELS,
  maskPhone,
  parseTicket,
  type PipelineStatus,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";

type KanbanBoardProps = {
  leads: Lead[];
  isAdmin?: boolean;
  /** Abre o detalhe deste lead (ex.: logo após criar). */
  focusLead?: Lead | null;
  onFocusLeadConsumed?: () => void;
};

/** Resolve coluna do funil: drop na coluna (status) ou em cima de outro card (lead id). */
function resolveDropStatus(
  overId: string | number | undefined | null,
  leads: Lead[],
): PipelineStatus | null {
  if (overId == null) return null;
  const id = String(overId);
  if ((PIPELINE as readonly string[]).includes(id)) return id as PipelineStatus;
  const target = leads.find((l) => l.id === id);
  if (target && (PIPELINE as readonly string[]).includes(target.status)) {
    return target.status as PipelineStatus;
  }
  return null;
}

function LeadCardContent({ lead }: { lead: Lead }) {
  const timeAgo = formatDistanceToNow(new Date(lead.atualizado_em || lead.criado_em), {
    addSuffix: false,
    locale: ptBR,
  });

  return (
    <>
      <p className="truncate text-[13px] font-bold leading-snug text-foreground">
        {lead.nome ?? "Sem nome"}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {maskPhone(lead.telefone)}
        </span>
        {lead.canal ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide",
              CANAL_COLORS[lead.canal] ?? "bg-secondary text-muted-foreground",
            )}
          >
            {lead.canal}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[10.5px] text-muted-foreground/70">{timeAgo} atrás</p>
    </>
  );
}

function LeadCard({ lead, onOpen }: { lead: Lead; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: lead.id,
    data: { lead },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "card-lift flex w-full overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-card)]",
        isDragging && "opacity-40",
        lead.status === "perdido" && "opacity-75",
      )}
    >
      {/* Handle de arrastar — separado do clique que abre o detalhe */}
      <button
        type="button"
        className="flex shrink-0 cursor-grab items-center justify-center border-r border-border/70 px-1.5 text-muted-foreground hover:bg-secondary/60 active:cursor-grabbing"
        aria-label={`Arrastar ${lead.nome ?? "lead"}`}
        {...listeners}
        {...attributes}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 p-3 text-left">
        <LeadCardContent lead={lead} />
        <p className="mt-1.5 text-[10px] font-medium text-sky-700/80">Toque para abrir</p>
      </button>
    </div>
  );
}

function KanbanColumn({
  status,
  leads,
  onOpen,
}: {
  status: PipelineStatus;
  leads: Lead[];
  onOpen: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const style = COL_STYLES[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full min-h-0 w-[236px] shrink-0 flex-col rounded-2xl border p-3 shadow-[var(--shadow-xs)] transition-shadow duration-200",
        style.col,
        isOver ? "border-sky-400 shadow-[var(--shadow-card)] ring-2 ring-sky-200" : "border-border/70",
      )}
    >
      <div className="mb-3 flex shrink-0 items-center justify-between border-b border-black/[0.06] pb-3">
        <h3 className={cn("text-[11.5px] font-bold uppercase tracking-[0.05em]", style.header)}>
          {STATUS_LABELS[status]}
        </h3>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold shadow-[var(--shadow-xs)]">
          {leads.length}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onOpen={() => onOpen(lead)} />
        ))}
        {leads.length === 0 ? (
          <p className="m-auto text-center text-[11.5px] text-muted-foreground/50">
            Arraste um lead aqui
          </p>
        ) : null}
      </div>
    </div>
  );
}

function MotivoPerdaDialog({
  open,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (motivo: string) => void;
  loading: boolean;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Motivo da perda</DialogTitle>
        </DialogHeader>
        <select
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Selecione…</option>
          {Object.entries(MOTIVO_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            disabled={!motivo || loading}
            onClick={() => onConfirm(motivo)}
            className="bg-rose-600 hover:bg-rose-700"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Marcar perdido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FunilHeader({ leads }: { leads: Lead[] }) {
  const active = leads.filter((l) => l.status !== "perdido");
  const convertidos = leads.filter((l) => l.status === "convertido");
  const taxa = active.length > 0 ? Math.round((convertidos.length / active.length) * 100) : 0;

  const tickets = convertidos
    .map((l) => parseTicket(l.observacoes))
    .filter((n): n is number => n != null && !Number.isNaN(n));
  const ticketMedio =
    tickets.length > 0 ? tickets.reduce((a, b) => a + b, 0) / tickets.length : null;

  const novos = leads.filter((l) => l.status === "novo");
  const agendados = leads.filter(
    (l) => l.status === "agendado" || l.status === "atendido" || l.status === "convertido",
  );
  const tempos = leads
    .filter((l) => l.status !== "novo")
    .map((l) => (new Date(l.atualizado_em).getTime() - new Date(l.criado_em).getTime()) / 36e5)
    .filter((h) => h >= 0);
  const tempoMedio = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : null;

  const cards = [
    {
      label: "Total no funil",
      value: String(active.length),
      icon: Layers,
      tint: "blue" as const,
      delta: {
        value: `${novos.length} novos`,
        label: `· ${agendados.length} avançados`,
        direction: "neutral" as const,
      },
    },
    { label: "Taxa conversão", value: `${taxa}%`, icon: TrendingUp, tint: "green" as const },
    {
      label: "Tempo médio novo→agendado",
      value: tempoMedio != null ? `${tempoMedio.toFixed(0)}h` : "—",
      icon: Clock,
      tint: "amber" as const,
    },
    {
      label: "Ticket médio",
      value:
        ticketMedio != null
          ? ticketMedio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
          : "—",
      icon: Wallet,
      tint: "violet" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => (
        <KpiCard
          key={card.label}
          label={card.label}
          value={card.value}
          icon={card.icon}
          tint={card.tint}
          format="raw"
          delta={card.delta}
        />
      ))}
    </div>
  );
}

export function KanbanBoard({ leads, focusLead, onFocusLeadConsumed }: KanbanBoardProps) {
  const qc = useQueryClient();
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [fallbackLead, setFallbackLead] = useState<Lead | null>(null);
  const [pendingPerda, setPendingPerda] = useState<{
    leadId: string;
  } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  useEffect(() => {
    if (!focusLead) return;
    setSelectedId(focusLead.id);
    setFallbackLead(focusLead);
    onFocusLeadConsumed?.();
  }, [focusLead, onFocusLeadConsumed]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return (
      leads.find((l) => l.id === selectedId) ??
      (fallbackLead?.id === selectedId ? fallbackLead : null)
    );
  }, [leads, selectedId, fallbackLead]);

  const grouped = useMemo(() => {
    return PIPELINE.reduce(
      (acc, status) => {
        acc[status] = leads.filter((l) => l.status === status);
        return acc;
      },
      {} as Record<PipelineStatus, Lead[]>,
    );
  }, [leads]);

  const move = useMutation({
    mutationFn: async ({
      leadId,
      novo,
      motivo,
    }: {
      leadId: string;
      novo: PipelineStatus;
      motivo?: string | null;
    }) => moverLeadStatus(leadId, novo, motivo),
    onSuccess: () => {
      toast.success("Lead movido");
      void qc.invalidateQueries({ queryKey: ["leads-kanban"] });
      setPendingPerda(null);
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao mover lead"),
  });

  function onDragStart(event: DragStartEvent) {
    const lead = event.active.data.current?.lead as Lead | undefined;
    setActiveLead(lead ?? null);
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveLead(null);
    const lead = event.active.data.current?.lead as Lead | undefined;
    if (!lead) return;

    const novo = resolveDropStatus(event.over?.id, leads);
    if (!novo || lead.status === novo) return;

    if (novo === "perdido") {
      setPendingPerda({ leadId: lead.id });
      return;
    }

    move.mutate({ leadId: lead.id, novo });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div
          className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden px-1"
          style={
            { scrollbarWidth: "thin", WebkitOverflowScrolling: "touch" } as React.CSSProperties
          }
        >
          <div className="flex h-full min-h-[360px] gap-3.5" style={{ minWidth: "max-content" }}>
            {PIPELINE.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                leads={grouped[status]}
                onOpen={(lead) => setSelectedId(lead.id)}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeLead ? (
            <div className="w-[212px] rounded-2xl border border-sky-300 bg-card p-3 text-left shadow-[var(--shadow-float)]">
              <LeadCardContent lead={activeLead} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {pendingPerda ? (
        <MotivoPerdaDialog
          key={pendingPerda.leadId}
          open
          loading={move.isPending}
          onCancel={() => setPendingPerda(null)}
          onConfirm={(motivo) => {
            move.mutate({ leadId: pendingPerda.leadId, novo: "perdido", motivo });
          }}
        />
      ) : null}

      {selected ? (
        <LeadDetailDialog lead={selected} onClose={() => setSelectedId(null)} />
      ) : null}
    </div>
  );
}
