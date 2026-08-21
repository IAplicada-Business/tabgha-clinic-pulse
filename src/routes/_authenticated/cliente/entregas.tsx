import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ClipboardCheck, Clock, Eye, Loader2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/cliente/entregas")({
  component: EntregasPage,
  head: () => ({ meta: [{ title: "Entregas — Portal" }] }),
});

type Entrega = Tables<"entregas">;

const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_revisao: "Em revisão",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
};

const STATUS_BADGE_VARIANT: Record<string, BadgeProps["variant"]> = {
  pendente: "warning",
  em_revisao: "info",
  aprovada: "success",
  rejeitada: "error",
};

const STATUS_TINT: Record<string, "blue" | "sky" | "amber" | "green" | "rose" | "violet"> = {
  pendente: "amber",
  em_revisao: "sky",
  aprovada: "green",
  rejeitada: "rose",
};

const STATUS_ICON: Record<string, typeof Clock> = {
  pendente: Clock,
  em_revisao: Eye,
  aprovada: CheckCircle,
  rejeitada: XCircle,
};

function EntregaModal({ entrega, onClose }: { entrega: Entrega; onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const qc = useQueryClient();
  const canRespond = entrega.status === "pendente" || entrega.status === "em_revisao";

  const responder = useMutation({
    mutationFn: async (aprovada: boolean) => {
      const { error } = await supabase.rpc("responder_entrega", {
        _id: entrega.id,
        _aprovada: aprovada,
        _resposta: feedback.trim() || (aprovada ? "Aprovado" : "Precisa de ajustes"),
      });
      if (error) throw error;
    },
    onSuccess: (_data, aprovada) => {
      toast.success(aprovada ? "Entrega aprovada!" : "Entrega devolvida para revisão.");
      void qc.invalidateQueries({ queryKey: ["cliente", "entregas"] });
      void qc.invalidateQueries({ queryKey: ["cliente", "dashboard"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao responder entrega."),
  });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entrega.titulo ?? "Entrega"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div>
              Tipo: <span className="text-foreground">{entrega.tipo ?? "—"}</span>
            </div>
            <div>
              Status:{" "}
              <span className="text-foreground">
                {STATUS_LABELS[entrega.status] ?? entrega.status}
              </span>
            </div>
            <div className="col-span-2">
              Criada em:{" "}
              <span className="text-foreground">
                {format(new Date(entrega.criado_em), "dd MMM yyyy HH:mm", { locale: ptBR })}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            {entrega.url_briefing ? (
              <a
                href={entrega.url_briefing}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Briefing
              </a>
            ) : null}
            {entrega.url_arquivo_bruto ? (
              <a
                href={entrega.url_arquivo_bruto}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Arquivo bruto
              </a>
            ) : null}
            {entrega.url_arquivo_final || entrega.url_arquivo ? (
              <a
                href={(entrega.url_arquivo_final || entrega.url_arquivo)!}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Arquivo final
              </a>
            ) : null}
          </div>

          {entrega.resposta_cliente ? (
            <div className="rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
              {entrega.resposta_cliente}
            </div>
          ) : null}

          {canRespond ? (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">
                Feedback (opcional ao rejeitar)
              </p>
              <Textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={3}
                placeholder="Descreva o que precisa ser ajustado…"
              />
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={responder.isPending}>
            Fechar
          </Button>
          {canRespond ? (
            <>
              <Button
                variant="outline"
                className="gap-1 text-destructive hover:bg-destructive/10"
                onClick={() => responder.mutate(false)}
                disabled={responder.isPending}
              >
                <XCircle className="h-4 w-4" /> Rejeitar
              </Button>
              <Button
                className="gap-1"
                onClick={() => responder.mutate(true)}
                disabled={responder.isPending}
              >
                {responder.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Aprovar
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EntregasPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [selected, setSelected] = useState<Entrega | null>(null);
  const [filter, setFilter] = useState<"acao" | "todas">("acao");

  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ["cliente", "entregas", clienteId],
    enabled: Boolean(clienteId),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entregas")
        .select("*")
        .eq("cliente_id", clienteId!)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendentes = entregas.filter((e) => e.status === "pendente" || e.status === "em_revisao");
  const visible = filter === "acao" ? pendentes : entregas;

  return (
    <div className="space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow-pill">Portal</span>
          <h1 className="mt-2 text-xl font-bold tracking-tight">Entregas</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Aprove ou peça ajustes nas peças da Tabgha.
          </p>
          {pendentes.length > 0 ? (
            <p className="mt-1 text-xs font-medium text-amber-700">
              {pendentes.length} {pendentes.length === 1 ? "entrega aguarda" : "entregas aguardam"}{" "}
              sua aprovação
            </p>
          ) : null}
        </div>
        <div className="segmented">
          <button
            type="button"
            data-active={filter === "acao"}
            className="segmented-item"
            onClick={() => setFilter("acao")}
          >
            Precisam de ação
          </button>
          <button
            type="button"
            data-active={filter === "todas"}
            className="segmented-item"
            onClick={() => setFilter("todas")}
          >
            Todas
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" />}
          title={filter === "acao" ? "Nada pendente" : "Nenhuma entrega ainda"}
          description={
            filter === "acao"
              ? "Quando a Tabgha enviar uma peça, ela aparece aqui para aprovação."
              : "As entregas do seu contrato aparecem nesta lista."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {visible.map((entrega) => {
            const StatusIcon = STATUS_ICON[entrega.status] ?? ClipboardCheck;
            return (
              <div
                key={entrega.id}
                className="card-lift flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-[var(--shadow-xs)]"
              >
                <div className={`icon-chip icon-chip-${STATUS_TINT[entrega.status] ?? "blue"} h-10 w-10 shrink-0`}>
                  <StatusIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entrega.titulo ?? "Sem título"}</p>
                  <p className="text-xs text-muted-foreground">
                    {entrega.tipo ?? "Entrega"} ·{" "}
                    {format(new Date(entrega.criado_em), "dd MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge variant={STATUS_BADGE_VARIANT[entrega.status] ?? "secondary"}>
                    {STATUS_LABELS[entrega.status] ?? entrega.status}
                  </Badge>
                  <Button size="sm" onClick={() => setSelected(entrega)}>
                    {entrega.status === "pendente" || entrega.status === "em_revisao"
                      ? "Revisar"
                      : "Ver"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected ? <EntregaModal entrega={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
