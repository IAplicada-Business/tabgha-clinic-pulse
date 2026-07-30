import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, ClipboardCheck, Loader2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { EmptyState } from "@/components/EmptyState";
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

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-amber-100 text-amber-700",
  em_revisao: "bg-sky-100 text-sky-700",
  aprovada: "bg-emerald-100 text-emerald-700",
  rejeitada: "bg-rose-100 text-rose-700",
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
      <div>
        <h1 className="text-xl font-bold tracking-tight">Entregas</h1>
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
      <div className="flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 p-1">
        <Button
          size="sm"
          variant={filter === "acao" ? "default" : "ghost"}
          className="h-7 px-3 text-xs"
          onClick={() => setFilter("acao")}
        >
          Precisam de ação
        </Button>
        <Button
          size="sm"
          variant={filter === "todas" ? "default" : "ghost"}
          className="h-7 px-3 text-xs"
          onClick={() => setFilter("todas")}
        >
          Todas
        </Button>
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
        <div className="divide-y divide-border rounded-xl border border-border">
          {visible.map((entrega) => (
            <div
              key={entrega.id}
              className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entrega.titulo ?? "Sem título"}</p>
                <p className="text-xs text-muted-foreground">
                  {entrega.tipo ?? "Entrega"} ·{" "}
                  {format(new Date(entrega.criado_em), "dd MMM yyyy", { locale: ptBR })}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[entrega.status] ?? "bg-muted text-muted-foreground"}`}
                >
                  {STATUS_LABELS[entrega.status] ?? entrega.status}
                </span>
                <Button size="sm" onClick={() => setSelected(entrega)}>
                  {entrega.status === "pendente" || entrega.status === "em_revisao"
                    ? "Revisar"
                    : "Ver"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected ? <EntregaModal entrega={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
