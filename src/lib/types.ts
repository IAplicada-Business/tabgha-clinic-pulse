import type { Tables } from "@/integrations/supabase/types";

export type WhatsappConversation = {
  id: string;
  cliente_id: string;
  lead_id: string | null;
  contact_phone: string;
  contact_name: string | null;
  origem: string;
  state: string;
  step_count: number;
  bot_score: number | null;
  bot_notes?: Record<string, unknown> | null;
  owner_state: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;
  closed_at: string | null;
  clientes?: Pick<Tables<"clientes">, "id" | "nome"> | null;
  leads?: Pick<Tables<"leads">, "id" | "nome" | "telefone" | "status"> | null;
};

export type WhatsappMessage = {
  id: string;
  conversation_id: string;
  cliente_id: string;
  direction: string;
  sender_type: string;
  body: string;
  sent_at: string;
};

export type InboxTab = "awaiting_human" | "active" | "closed" | "all";
export type OrigemFilter = "consulta" | "opme" | "duvida" | null;
export type LastMsgSenderFilter = "bot" | "human" | "lead" | null;

export type ConversationFilters = {
  tab: InboxTab;
  origem: OrigemFilter;
  lastMsgSender: LastMsgSenderFilter;
  noReplyHours: number | null;
  clienteId: string | null;
  search: string;
};

export type MobilePane = "list" | "chat" | "info";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function getLeads(actions: Array<{ action_type?: string; value?: string }> = []) {
  const leadAction = actions.find((action) => action.action_type === "lead");
  const pixelLead = actions.find(
    (action) => action.action_type === "offsite_conversion.fb_pixel_lead",
  );

  return Number(leadAction?.value ?? 0) + Number(pixelLead?.value ?? 0);
}

export function defaultRange(days = 7) {
  const until = new Date();
  const since = new Date();
  since.setDate(until.getDate() - (days - 1));

  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}
