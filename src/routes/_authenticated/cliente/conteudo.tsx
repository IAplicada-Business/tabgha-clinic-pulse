import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/cliente/conteudo")({
  component: ConteudoPage,
  head: () => ({ meta: [{ title: "Conteúdo — Portal" }] }),
});

type ConteudoRow = Tables<"conteudos">;

const STATUS_LABELS: Record<string, string> = {
  briefing: "Briefing", roteiro: "Roteiro", producao: "Produção",
  aprovacao: "Aguardando aprovação", agendado: "Agendado", postado: "Postado",
};
const STATUS_COLORS: Record<string, string> = {
  briefing: "bg-slate-100 text-slate-600", roteiro: "bg-blue-100 text-blue-700",
  producao: "bg-yellow-100 text-yellow-700", aprovacao: "bg-yellow-100 text-yellow-700 font-semibold",
  agendado: "bg-blue-100 text-blue-700", postado: "bg-green-100 text-green-700",
};

function AprovacaoModal({ conteudo, onClose }: { conteudo: Tables<"conteudos">; onClose: () => void }) {
  const [feedback, setFeedback] = useState("");
  const qc = useQueryClient();
  const { profile } = useAuth();

  const aprovar = useMutation({
    mutationFn: async (aprovado: boolean) => {
      if (!profile?.cliente_id) throw new Error("Cliente não vinculado.");
      const { error } = await supabase.rpc("responder_conteudo", {
        _id: conteudo.id,
        _aprovada: aprovado,
        _feedback: feedback.trim() || undefined,
      });
      if (error) throw error;
    },
    onSuccess: (_, aprovado) => {
      toast.success(aprovado ? "Conteúdo aprovado!" : "Conteúdo devolvido para revisão.");
      qc.invalidateQueries({ queryKey: ["cliente", "conteudos"] });
      qc.invalidateQueries({ queryKey: ["cliente", "dashboard"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao processar resposta."),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{conteudo.titulo}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
            <div>Rede: <span className="text-foreground">{conteudo.rede ?? "—"}</span></div>
            <div>Tipo: <span className="text-foreground">{conteudo.tipo ?? "—"}</span></div>
            {conteudo.data_postagem && (
              <div>Postagem: <span className="text-foreground">{format(new Date(conteudo.data_postagem), "dd MMM yyyy", { locale: ptBR })}</span></div>
            )}
          </div>
          {conteudo.roteiro && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Roteiro</p>
              <p className="rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap">{conteudo.roteiro}</p>
            </div>
          )}
          {conteudo.url_briefing && (
            <a href={conteudo.url_briefing} target="_blank" rel="noreferrer"
              className="text-xs text-primary underline">Ver briefing</a>
          )}
          {conteudo.url_arquivo && (
            <a href={conteudo.url_arquivo} target="_blank" rel="noreferrer"
              className="text-xs text-primary underline">Ver arquivo</a>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Feedback (opcional ao rejeitar)</p>
            <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="Descreva o que precisa ser ajustado…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={aprovar.isPending}>Cancelar</Button>
          <Button variant="outline" className="gap-1 text-destructive hover:bg-destructive/10"
            onClick={() => aprovar.mutate(false)} disabled={aprovar.isPending}>
            <XCircle className="h-4 w-4" /> Rejeitar
          </Button>
          <Button className="gap-1" onClick={() => aprovar.mutate(true)} disabled={aprovar.isPending}>
            {aprovar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Aprovar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConteudoPage() {
  const { profile } = useAuth();
  const clienteId = profile?.cliente_id;
  const [selected, setSelected] = useState<Tables<"conteudos"> | null>(null);

  const { data: conteudos = [], isLoading } = useQuery({
    queryKey: ["cliente", "conteudos", clienteId],
    enabled: !!clienteId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos").select("*").eq("cliente_id", clienteId!)
        .order("data_postagem", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendentes = conteudos.filter((c) => c.status === "aprovacao");

  const STATUS_PIPELINE_ORDER = ["briefing", "roteiro", "producao", "aprovacao", "agendado", "postado"] as const;
  const pipelineCounts = STATUS_PIPELINE_ORDER
    .map((s) => ({ s, label: STATUS_LABELS[s], count: conteudos.filter((c) => c.status === s).length, color: STATUS_COLORS[s] }))
    .filter(({ count }) => count > 0);

  return (
    <div className="px-6 py-6 space-y-6">
      <div>
        <span className="eyebrow-pill">Editorial</span>
        <h1 className="mt-2 text-xl font-bold tracking-tight">Conteúdo</h1>
        {pendentes.length > 0 && (
          <p className="mt-0.5 text-xs font-medium text-yellow-700">
            {pendentes.length} {pendentes.length === 1 ? "conteúdo aguarda" : "conteúdos aguardam"} sua aprovação
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : conteudos.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Nenhum conteúdo ainda"
          description="Os conteúdos aparecem aqui conforme a equipe produzir." />
      ) : (
        <>
          {pipelineCounts.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {pipelineCounts.map(({ s, label, count, color }) => (
                <div key={s} className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 shadow-[var(--shadow-xs)]">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${color}`}>{label}</span>
                  <span className="text-sm font-bold">{count}</span>
                </div>
              ))}
            </div>
          )}
          <div className="divide-y divide-border rounded-xl border border-border">
            {conteudos.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.titulo ?? "Sem título"}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.rede ?? "—"} · {c.tipo ?? "—"}
                    {c.data_postagem && ` · ${format(new Date(c.data_postagem), "dd MMM", { locale: ptBR })}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}>
                    {STATUS_LABELS[c.status] ?? c.status}
                  </span>
                  {c.status === "aprovacao" && (
                    <Button size="sm" onClick={() => setSelected(c)}>Revisar</Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selected && <AprovacaoModal conteudo={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
