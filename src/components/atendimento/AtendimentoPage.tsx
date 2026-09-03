import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useWhatsappConversations } from "@/hooks/useWhatsappConversations";
import { useWhatsappMessages } from "@/hooks/useWhatsappMessages";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { supabase } from "@/integrations/supabase/client";
import type { ConversationFilters, InboxTab, MobilePane, WhatsappConversation } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BOT_NOTE_FIELDS, formatBotNote } from "@/lib/pietro";
import { sendWhatsappMessage } from "@/functions/whatsapp/send.functions";

const FILTER_KEYS = {
  origem: "atendimento.filterOrigem",
  lastMsg: "atendimento.filterLastMsg",
  noReplyHours: "atendimento.filterNoReplyHours",
  cliente: "atendimento.filterCliente",
} as const;

type AtendimentoPageProps = {
  isAdmin?: boolean;
};

function loadStoredFilter<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

function ownerStateDot(ownerState: string | null) {
  if (ownerState === "human_active") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        <span className="text-[10.5px] font-semibold text-emerald-700">Humano</span>
      </span>
    );
  }
  if (ownerState === "human_alert") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-[10.5px] font-semibold text-amber-700">Aguardando humano</span>
      </span>
    );
  }
  if (ownerState === "bot") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
        <span className="text-[10.5px] font-semibold text-sky-700">Bot</span>
      </span>
    );
  }
  if (ownerState === "closed") {
    return (
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        <span className="text-[10.5px] font-semibold text-muted-foreground">Fechada</span>
      </span>
    );
  }
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-100 text-amber-700">
      {ownerState}
    </span>
  );
}

function ChatBubble({
  direction,
  senderType,
  body,
}: {
  direction: string;
  senderType: string;
  body: string;
}) {
  const outbound = direction === "outbound";

  return (
    <div className={cn("flex animate-fade-up", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] px-3.5 py-2.5 text-sm shadow-[var(--shadow-card)]",
          outbound ? "rounded-2xl rounded-br-md" : "rounded-2xl rounded-bl-md",
          outbound && senderType === "human" && "bg-emerald-600 text-white",
          outbound && senderType !== "human" && "border border-sky-100 bg-sky-500/10 text-sky-900",
          !outbound && "border border-border bg-card text-foreground",
        )}
      >
        {body}
      </div>
    </div>
  );
}

export function AtendimentoPage({ isAdmin = false }: AtendimentoPageProps) {
  const [tab, setTab] = useState<InboxTab>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("list");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [clienteFilter, setClienteFilter] = useState<string | null>(() =>
    loadStoredFilter(FILTER_KEYS.cliente, null),
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filters: ConversationFilters = useMemo(
    () => ({
      tab,
      origem: loadStoredFilter(FILTER_KEYS.origem, null),
      lastMsgSender: loadStoredFilter(FILTER_KEYS.lastMsg, null),
      noReplyHours: loadStoredFilter(FILTER_KEYS.noReplyHours, null),
      clienteId: isAdmin ? clienteFilter : null,
      search,
    }),
    [tab, search, clienteFilter, isAdmin],
  );

  useEffect(() => {
    if (isAdmin) {
      localStorage.setItem(FILTER_KEYS.cliente, JSON.stringify(clienteFilter));
    }
  }, [clienteFilter, isAdmin]);

  const { data: clientesOptions = [] } = useClientesOptions();
  const { data: conversations = [], isLoading } = useWhatsappConversations(filters);
  const selected = conversations.find((item) => item.id === selectedId) ?? null;
  const { data: messages = [], isLoading: messagesLoading } = useWhatsappMessages(selectedId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!selectedId || !message.trim()) {
      return;
    }

    setSending(true);
    try {
      await sendWhatsappMessage({
        data: {
          conversation_id: selectedId,
          body: message.trim(),
          sender_type: "human",
        },
      });
      setMessage("");
    } finally {
      setSending(false);
    }
  }

  async function takeConversation(conversation: WhatsappConversation) {
    await supabase
      .from("whatsapp_conversations")
      .update({ owner_state: "human_active" })
      .eq("id", conversation.id);
  }

  async function returnToBot(conversation: WhatsappConversation) {
    await supabase
      .from("whatsapp_conversations")
      .update({ owner_state: "bot" })
      .eq("id", conversation.id);
  }

  async function closeConversation(conversation: WhatsappConversation) {
    await supabase
      .from("whatsapp_conversations")
      .update({
        state: "closed",
        owner_state: "closed",
        closed_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      {/* Conversation list sidebar */}
      <aside
        className={cn(
          "flex w-full flex-col border-r border-border md:w-80",
          mobilePane !== "list" && "hidden md:flex",
        )}
      >
        <div className="space-y-2 border-b border-border p-3">
          {isAdmin && (
            <select
              value={clienteFilter ?? ""}
              onChange={(e) => setClienteFilter(e.target.value || null)}
              className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Todos os clientes</option>
              {clientesOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          )}
          <Tabs value={tab} onValueChange={(value) => setTab(value as InboxTab)}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="awaiting_human" className="text-xs px-1">
                Aguardando
              </TabsTrigger>
              <TabsTrigger value="active" className="text-xs px-1">
                Ativas
              </TabsTrigger>
              <TabsTrigger value="closed" className="text-xs px-1">
                Fechadas
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs px-1">
                Todas
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Input
            placeholder="Buscar nome ou telefone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-xl"
          />
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
          ) : (
            conversations.map((conversation, i) => {
              const displayName = conversation.contact_name ?? conversation.contact_phone ?? "?";
              const isSelected = selectedId === conversation.id;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(conversation.id);
                    setMobilePane("chat");
                  }}
                  className={cn(
                    "animate-fade-up mx-2 my-0.5 flex w-[calc(100%-1rem)] items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    isSelected ? "bg-primary/10" : "hover:bg-secondary/50",
                  )}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="icon-chip icon-chip-blue h-9 w-9 shrink-0 text-[11px] font-bold">
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{displayName}</span>
                      {ownerStateDot(conversation.owner_state)}
                    </div>
                    {isAdmin && conversation.clientes?.nome ? (
                      <span className="truncate text-[10.5px] font-medium text-muted-foreground">
                        {conversation.clientes.nome}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat area */}
      <section
        className={cn("flex min-w-0 flex-1 flex-col", mobilePane !== "chat" && "hidden md:flex")}
      >
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <span className="text-[10px] font-bold uppercase tracking-widest text-sky-700">
              Atendimento
            </span>
            <p className="text-sm">Selecione uma conversa para começar</p>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div
              className="flex items-center justify-between border-b border-border px-5 py-3"
              style={{ background: "linear-gradient(135deg, #0B1B3E 0%, #0F2550 100%)" }}
            >
              <div>
                <p className="font-semibold text-white">
                  {selected.contact_name ?? selected.contact_phone}
                </p>
                <p className="mt-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-sky-300/80">
                  {selected.state}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-sky-400/40 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20 hover:text-white"
                  onClick={() => void takeConversation(selected)}
                >
                  Assumir
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-violet-400/40 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20 hover:text-white"
                  onClick={() => void returnToBot(selected)}
                  disabled={selected.owner_state === "bot"}
                >
                  Devolver pro bot
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-400/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 hover:text-white"
                  onClick={() => void closeConversation(selected)}
                >
                  Encerrar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white/70 hover:text-white md:hidden"
                  onClick={() => setMobilePane("info")}
                >
                  Info
                </Button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-secondary/20 p-4">
              {messagesLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-2/3 rounded-2xl" />
                  <Skeleton className="ml-auto h-12 w-1/2 rounded-2xl" />
                  <Skeleton className="h-16 w-3/4 rounded-2xl" />
                </div>
              ) : (
                messages.map((item) => (
                  <ChatBubble
                    key={item.id}
                    direction={item.direction}
                    senderType={item.sender_type}
                    body={item.body}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="border-t border-border bg-card p-3">
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Escreva uma mensagem… (Cmd+Enter para enviar)"
                disabled={selected.state === "closed" || selected.state === "stalled"}
                className="resize-none rounded-xl text-sm"
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <div className="mt-2 flex justify-end">
                <Button
                  onClick={() => void handleSend()}
                  disabled={sending || !message.trim()}
                  className="rounded-xl bg-sky-600 text-white hover:bg-sky-700"
                >
                  {sending ? "Enviando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Lead info panel */}
      <aside
        className={cn(
          "hidden w-72 border-l border-border bg-card md:block",
          mobilePane === "info" && "block md:block",
        )}
      >
        {selected ? (
          <div className="animate-fade-up space-y-4 p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Informações do lead
            </p>

            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              <div className="px-4 py-3">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Nome
                </p>
                <p className="text-sm font-medium">
                  {selected.leads?.nome ?? "Sem lead vinculado"}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Telefone
                </p>
                <p className="text-sm">{selected.leads?.telefone ?? selected.contact_phone}</p>
              </div>
              <div className="px-4 py-3">
                <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Origem
                </p>
                <p className="text-sm">{selected.origem ?? "—"}</p>
              </div>
              <div className="px-4 py-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  Bot score
                </p>
                <p className="animate-numeric-pop text-2xl font-extrabold tracking-tight text-sky-700">
                  {selected.bot_score ?? 0}
                </p>
                <div className="mt-2 h-0.5 w-full rounded-full bg-sky-500/30">
                  <div
                    className="h-0.5 rounded-full bg-sky-500 transition-all"
                    style={{ width: `${Math.min(selected.bot_score ?? 0, 100)}%` }}
                  />
                </div>
              </div>
              {selected.bot_notes && Object.keys(selected.bot_notes).length > 0 ? (
                <div className="px-4 py-3">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Notas do Pietro
                  </p>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    {BOT_NOTE_FIELDS.map(({ key, label }) => {
                      const value = formatBotNote(key, selected.bot_notes?.[key]);
                      if (value == null) return null;
                      return (
                        <p key={key}>
                          <span className="font-semibold text-foreground">{label}: </span>
                          {value}
                        </p>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-secondary/30 px-4 py-3">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Status atual
              </p>
              {ownerStateDot(selected.owner_state)}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Informações do lead
            </p>
            <p className="text-sm text-muted-foreground">
              Selecione uma conversa para ver detalhes.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
