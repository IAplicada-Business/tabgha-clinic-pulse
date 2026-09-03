import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MessageSquare, Sparkles, Sprout, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { converterLeadComTicket, moverLeadStatus, type Lead } from "@/hooks/useLeads";
import { supabase } from "@/integrations/supabase/client";
import {
  COL_STYLES,
  MOTIVO_LABELS,
  PIPELINE,
  STATUS_LABELS,
  parseTicket,
  type PipelineStatus,
} from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { BOT_NOTE_FIELDS, formatBotNote, isHiddenBotNote } from "@/lib/pietro";
import { SEQUENCIA_LETRA, type SequenciaKey } from "@/lib/nutricao";

type Tab = "dados" | "insights" | "conversas" | "automacoes";

type ConversationInsight = {
  id: string;
  bot_score: number | null;
  bot_notes: Record<string, unknown> | null;
  state: string | null;
  owner_state: string | null;
  atualizado_em: string;
};

const INSIGHT_KEYS = BOT_NOTE_FIELDS.map((f) => f.key);

type AutomacaoLog = {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  criado_em: string;
};

/** "Automação · Sequência B · mensagem 2 · enviada em 12/03/2026 10:00". */
function rotuloAutomacao(log: AutomacaoLog): string {
  const meta = (log.metadata ?? {}) as Record<string, unknown>;
  const quando = new Date(log.criado_em).toLocaleString("pt-BR");
  const seq = meta.sequencia as SequenciaKey | undefined;
  const letra =
    (meta.sequencia_letra as string | undefined) ??
    (seq && SEQUENCIA_LETRA[seq] ? SEQUENCIA_LETRA[seq] : null);
  if (log.action === "nutricao_enviada" && letra) {
    return `Automação · Sequência ${letra} · mensagem ${meta.mensagem ?? "?"} · enviada em ${quando}`;
  }
  if (log.action === "nutricao_teste") return `Automação · envio de teste · ${quando}`;
  return `Automação · ${log.action} · ${quando}`;
}

function asNotes(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

function hasMetaAttribution(lead: Lead) {
  return Boolean(
    lead.meta_ad_id ||
    lead.meta_ad_name ||
    lead.meta_campaign_id ||
    lead.meta_campaign_name ||
    lead.meta_form_id ||
    lead.meta_form_name ||
    lead.meta_page_id ||
    lead.meta_leadgen_id ||
    lead.canal === "meta" ||
    lead.canal === "facebook",
  );
}

function MetaAttrRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="mt-0.5 break-words font-medium">{value}</p>
    </div>
  );
}

type Props = {
  lead: Lead;
  onClose: () => void;
};

export function LeadDetailDialog({ lead, onClose }: Props) {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("dados");
  const [nome, setNome] = useState(lead.nome ?? "");
  const [telefone, setTelefone] = useState(lead.telefone ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [obs, setObs] = useState(lead.observacoes ?? "");
  const [status, setStatus] = useState(lead.status as PipelineStatus);
  const [motivo, setMotivo] = useState(lead.motivo_perda ?? "");
  const [ticket, setTicket] = useState(() => String(parseTicket(lead.observacoes) ?? ""));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setNome(lead.nome ?? "");
    setTelefone(lead.telefone ?? "");
    setEmail(lead.email ?? "");
    setObs(lead.observacoes ?? "");
    setStatus(lead.status as PipelineStatus);
    setMotivo(lead.motivo_perda ?? "");
    setTicket(String(parseTicket(lead.observacoes) ?? ""));
    setConfirmDelete(false);
    setTab("dados");
  }, [lead.id]);

  const { data: insights = [], isLoading: loadingInsights } = useQuery({
    queryKey: ["lead-insights", lead.id],
    enabled: tab === "insights" || tab === "conversas",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("id, bot_score, bot_notes, state, owner_state, atualizado_em")
        .eq("lead_id", lead.id)
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        bot_notes: asNotes(row.bot_notes),
      })) as ConversationInsight[];
    },
  });

  // Histórico das automações de nutrição — automation_logs guarda o lead_id no
  // metadata, então não existe tabela paralela de eventos do lead.
  const { data: automacoes = [], isLoading: loadingAutomacoes } = useQuery({
    queryKey: ["lead-automacoes", lead.id],
    enabled: tab === "automacoes",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_logs")
        .select("id, action, metadata, criado_em")
        .eq("cliente_id", lead.cliente_id)
        .filter("metadata->>lead_id", "eq", lead.id)
        .order("criado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as AutomacaoLog[];
    },
  });

  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["lead-messages", lead.id],
    enabled: tab === "conversas",
    queryFn: async () => {
      const { data: convs, error: convError } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("lead_id", lead.id);
      if (convError) throw convError;
      const ids = (convs ?? []).map((c) => c.id);
      if (ids.length === 0) return [];

      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .in("conversation_id", ids)
        .order("sent_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Informe o nome do lead.");
      if (status === "perdido" && !motivo) {
        throw new Error("Selecione o motivo da perda.");
      }

      if (status === "convertido" && ticket.trim()) {
        await converterLeadComTicket(lead.id, Number(ticket));
      } else if (status !== lead.status || (status === "perdido" && motivo !== lead.motivo_perda)) {
        await moverLeadStatus(lead.id, status, status === "perdido" ? motivo : null);
      }

      const { error } = await supabase
        .from("leads")
        .update({
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          email: email.trim() || null,
          observacoes: obs.trim() || null,
        })
        .eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead atualizado");
      void qc.invalidateQueries({ queryKey: ["leads-kanban"] });
      void qc.invalidateQueries({ queryKey: ["admin", "cliente"] });
      void qc.invalidateQueries({ queryKey: ["cliente", "pacientes"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").delete().eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead excluído");
      void qc.invalidateQueries({ queryKey: ["leads-kanban"] });
      void qc.invalidateQueries({ queryKey: ["admin", "cliente"] });
      void qc.invalidateQueries({ queryKey: ["cliente", "pacientes"] });
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || "Não foi possível excluir o lead."),
  });

  const primaryInsight = insights[0] ?? null;
  const notes = primaryInsight?.bot_notes;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
            <span className="truncate">{nome.trim() || lead.nome || "Lead"}</span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                COL_STYLES[status]?.badge,
              )}
            >
              {STATUS_LABELS[status]}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="segmented w-full sm:w-fit">
          {(
            [
              ["dados", "Dados"],
              ["insights", "Insights IA"],
              ["conversas", "Conversas"],
              ["automacoes", "Automações"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-active={tab === id}
              onClick={() => setTab(id)}
              className="segmented-item"
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "dados" ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="lead-nome">Nome</Label>
                <Input
                  id="lead-nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do lead"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-telefone">Telefone</Label>
                <Input
                  id="lead-telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="5511999999999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lead-email">Email</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-secondary/40 px-3 py-2.5 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Canal</span>
                <p className="mt-0.5 font-medium">{lead.canal ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">ICP</span>
                <p className="mt-0.5 font-medium">{lead.icp ?? "—"}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Criado em</span>
                <p className="mt-0.5 font-medium">
                  {new Date(lead.criado_em).toLocaleString("pt-BR")}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Atualizado</span>
                <p className="mt-0.5 font-medium">
                  {new Date(lead.atualizado_em).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>

            {hasMetaAttribution(lead) ? (
              <div className="space-y-2 rounded-xl border border-sky-200/70 bg-sky-50/50 px-3 py-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">
                  Origem Meta (formulário / anúncio)
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <MetaAttrRow
                    label="Anúncio"
                    value={
                      lead.meta_ad_name || (lead.meta_ad_id ? `Anúncio ${lead.meta_ad_id}` : null)
                    }
                  />
                  <MetaAttrRow
                    label="Campanha"
                    value={
                      lead.meta_campaign_name ||
                      lead.utm_campaign ||
                      (lead.meta_campaign_id ? `Campanha ${lead.meta_campaign_id}` : null)
                    }
                  />
                  <MetaAttrRow
                    label="Formulário"
                    value={
                      lead.meta_form_name ||
                      (lead.meta_form_id ? `Formulário ${lead.meta_form_id}` : null)
                    }
                  />
                  <MetaAttrRow label="Página Meta" value={lead.meta_page_id} />
                  <MetaAttrRow label="Leadgen ID" value={lead.meta_leadgen_id} />
                  <MetaAttrRow
                    label="UTM"
                    value={
                      [lead.utm_source, lead.utm_medium, lead.utm_campaign]
                        .filter(Boolean)
                        .join(" / ") || null
                    }
                  />
                </div>
                {!lead.meta_ad_id && !lead.meta_form_id && !lead.meta_leadgen_id ? (
                  <p className="text-xs text-muted-foreground">
                    Canal Meta, mas ainda sem IDs de anúncio/formulário. Rode “Importar leads Meta”
                    em Conectar Meta BM para enriquecer.
                  </p>
                ) : null}
              </div>
            ) : lead.utm_source || lead.utm_medium || lead.utm_campaign ? (
              <div className="rounded-xl bg-secondary/40 px-3 py-2.5 text-sm">
                <span className="text-xs text-muted-foreground">UTM</span>
                <p className="mt-0.5 break-all font-medium">
                  {[lead.utm_source, lead.utm_medium, lead.utm_campaign]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </p>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="lead-status">Estágio no funil</Label>
              <select
                id="lead-status"
                value={status}
                onChange={(e) => {
                  const next = e.target.value as PipelineStatus;
                  setStatus(next);
                  if (next !== "perdido") setMotivo("");
                }}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
              >
                {PIPELINE.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {status === "perdido" ? (
              <div className="space-y-1.5">
                <Label htmlFor="lead-motivo">Motivo da perda</Label>
                <select
                  id="lead-motivo"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  {Object.entries(MOTIVO_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {status === "convertido" ? (
              <div className="space-y-1.5">
                <Label htmlFor="lead-ticket">Ticket (R$)</Label>
                <Input
                  id="lead-ticket"
                  type="number"
                  min={0}
                  value={ticket}
                  onChange={(e) => setTicket(e.target.value)}
                  placeholder="ex: 450"
                />
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="lead-obs">Observações</Label>
              <Textarea
                id="lead-obs"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={4}
                placeholder="Anote contexto, preferências, próximos passos…"
              />
            </div>
          </div>
        ) : null}

        {tab === "insights" ? (
          <div className="space-y-3 text-sm">
            {loadingInsights ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !primaryInsight ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <Sparkles className="h-5 w-5" />
                <p className="text-sm">Ainda sem insights de IA para este lead.</p>
                <p className="max-w-xs text-center text-xs">
                  Eles aparecem quando há conversa WhatsApp com o Pietro/bot vinculado ao lead.
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-700/80">
                    Score do bot
                  </p>
                  <p className="mt-1 text-3xl font-extrabold tracking-tight text-sky-800">
                    {primaryInsight.bot_score ?? 0}
                  </p>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-sky-200">
                    <div
                      className="h-1.5 rounded-full bg-sky-600 transition-all"
                      style={{
                        width: `${Math.min(Math.max(primaryInsight.bot_score ?? 0, 0), 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-sky-800/70">
                    Estado: {primaryInsight.owner_state || primaryInsight.state || "—"}
                  </p>
                </div>

                {notes && Object.keys(notes).length > 0 ? (
                  <div className="space-y-2 rounded-xl border border-border bg-card px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Notas da evolução
                    </p>
                    <div className="space-y-2">
                      {BOT_NOTE_FIELDS.map(({ key, label }) => {
                        const value = formatBotNote(key, notes[key]);
                        if (value == null) return null;
                        return (
                          <div key={key}>
                            <p className="text-[11px] font-semibold text-foreground">{label}</p>
                            <p className="text-sm text-muted-foreground">{value}</p>
                          </div>
                        );
                      })}
                      {Object.entries(notes)
                        .filter(
                          ([key, value]) =>
                            !INSIGHT_KEYS.includes(key) &&
                            !isHiddenBotNote(key) &&
                            value != null &&
                            value !== "",
                        )
                        .map(([key, value]) => (
                          <div key={key}>
                            <p className="text-[11px] font-semibold text-foreground">{key}</p>
                            <p className="text-sm text-muted-foreground">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Há conversa vinculada, mas ainda sem notas estruturadas do bot.
                  </p>
                )}
              </>
            )}
          </div>
        ) : null}

        {tab === "conversas" ? (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {loadingMsgs ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                <MessageSquare className="h-5 w-5" />
                <p className="text-sm">Nenhuma conversa WhatsApp vinculada</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "px-3.5 py-2.5 text-sm shadow-[var(--shadow-xs)]",
                    msg.direction === "outbound"
                      ? "ml-8 rounded-2xl rounded-br-md bg-emerald-50 text-emerald-900"
                      : "mr-8 rounded-2xl rounded-bl-md border border-border bg-card",
                  )}
                >
                  <p className="whitespace-pre-wrap">{msg.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(msg.sent_at).toLocaleString("pt-BR")}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}

        {tab === "automacoes" ? (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {loadingAutomacoes ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : automacoes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <Sprout className="h-5 w-5" />
                <p className="text-sm">Nenhuma mensagem automática enviada para este lead.</p>
                <p className="max-w-xs text-center text-xs">
                  As sequências de nutrição entram sozinhas quando o card cai no status disparador
                  configurado em Automações → Nutrição de leads.
                </p>
              </div>
            ) : (
              automacoes.map((log) => {
                const texto = (log.metadata as Record<string, unknown> | null)?.texto;
                return (
                  <div
                    key={log.id}
                    className="rounded-xl border border-border bg-card px-3.5 py-2.5"
                  >
                    <p className="text-xs font-semibold">{rotuloAutomacao(log)}</p>
                    {typeof texto === "string" && texto ? (
                      <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-muted-foreground">
                        {texto}
                      </p>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {!confirmDelete ? (
              <Button
                type="button"
                variant="outline"
                className="border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {remove.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Confirmar exclusão
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Cancelar
                </Button>
              </>
            )}
          </div>
          <div className="flex w-full justify-end gap-2 sm:w-auto">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {tab === "dados" ? (
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending || (status === "perdido" && !motivo)}
              >
                {save.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
