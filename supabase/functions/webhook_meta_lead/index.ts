// Webhook Meta Lead Ads — captura real via Graph API.
//
// GET  → hub.verify_token (META_WEBHOOK_VERIFY_TOKEN)
// POST → leadgen events → Graph API → INSERT leads
//
// Cliente resolvido por dados_extras.meta.page_id (ou legado meta_page_id).
// Token: dados_extras.meta.access_token
// Mapa de campos: app_config.meta_form_map[form_id] ou _default

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { campanhaLiberada, campanhasPermitidas } from "../_shared/meta_campanhas.ts";
import {
  createAttributionCache,
  resolveMetaAttribution,
} from "../_shared/meta_lead_attribution.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERIFY_TOKEN = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") ?? "";
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type FieldData = { name?: string; values?: string[] };
type FormMap = Record<string, string[] | string>;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function pickField(fieldData: FieldData[], aliases: string[]): string | null {
  const lowered = aliases.map((a) => a.toLowerCase());
  for (const field of fieldData) {
    const name = (field.name ?? "").toLowerCase();
    if (lowered.includes(name)) {
      const value = field.values?.[0]?.trim();
      if (value) return value;
    }
  }
  return null;
}

type ClienteMeta = {
  id: string;
  dados_extras: { meta?: { access_token?: string; user_access_token?: string; page_name?: string; campanhas?: Array<{ id: string }> } } | null;
};

async function clientesByPage(pageId: string): Promise<ClienteMeta[]> {
  const { data: byNested } = await supabase
    .from("clientes")
    .select("id, dados_extras")
    .filter("dados_extras->meta->>page_id", "eq", pageId);

  if (byNested && byNested.length > 0) return byNested as ClienteMeta[];

  const { data: byLegacy } = await supabase
    .from("clientes")
    .select("id, dados_extras")
    .filter("dados_extras->>meta_page_id", "eq", pageId);

  return (byLegacy ?? []) as ClienteMeta[];
}

function tokenOf(cliente: ClienteMeta) {
  const meta = cliente.dados_extras?.meta;
  return meta?.user_access_token || meta?.access_token || null;
}

function escolherCliente(candidatos: ClienteMeta[], campaignId: string | null) {
  const comCampanha = candidatos.filter((c) =>
    campanhaLiberada(campaignId, campanhasPermitidas(c.dados_extras?.meta)),
  );
  return comCampanha[0] ?? null;
}

async function loadFormMap(formId: string | undefined): Promise<FormMap> {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "meta_form_map")
    .maybeSingle();

  const maps = (data?.valor ?? {}) as Record<string, FormMap>;
  if (formId && maps[formId]) return maps[formId];
  return maps._default ?? {
    nome: ["full_name", "name", "nome"],
    telefone: ["phone_number", "phone", "telefone"],
    email: ["email"],
  };
}

function aliasesFor(map: FormMap, key: string): string[] {
  const raw = map[key];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 200);
  }

  try {
    const entries = (body.entry as Array<Record<string, unknown>>) ?? [];
    let inseridos = 0;
    const attrCache = createAttributionCache();

    for (const entry of entries) {
      const changes = (entry.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        if (change.field !== "leadgen") continue;

        const value = (change.value ?? {}) as {
          page_id?: string;
          leadgen_id?: string;
          form_id?: string;
          created_time?: string;
          ad_id?: string;
          campaign_id?: string;
        };

        const pageId = value.page_id ?? (entry.id as string | undefined);
        const leadgenId = value.leadgen_id;
        if (!pageId || !leadgenId) continue;

        const candidatos = await clientesByPage(String(pageId));
        if (candidatos.length === 0) {
          await supabase.from("webhook_errors").insert({
            source: "meta_lead",
            payload: { pageId, leadgenId, change },
            error: "cliente não encontrado para page_id",
          });
          continue;
        }

        const tokenHost = candidatos.find((c) => tokenOf(c));
        const accessToken = tokenHost ? tokenOf(tokenHost) : null;
        if (!accessToken) {
          await supabase.from("webhook_errors").insert({
            source: "meta_lead",
            cliente_id: tokenHost?.id,
            payload: { pageId, leadgenId },
            error: "access_token Meta ausente em dados_extras.meta",
          });
          continue;
        }

        const graphUrl =
          `https://graph.facebook.com/${GRAPH_VERSION}/${leadgenId}` +
          `?access_token=${encodeURIComponent(accessToken)}` +
          `&fields=field_data,created_time,ad_id,campaign_id,form_id`;

        const graphRes = await fetch(graphUrl);
        if (!graphRes.ok) {
          const text = await graphRes.text();
          await supabase.from("webhook_errors").insert({
            source: "meta_lead",
            cliente_id: tokenHost?.id,
            payload: { pageId, leadgenId, status: graphRes.status, text },
            error: `Graph API error ${graphRes.status}`,
          });
          continue;
        }

        const leadPayload = (await graphRes.json()) as {
          field_data?: FieldData[];
          ad_id?: string;
          campaign_id?: string;
          form_id?: string;
        };

        const formId = leadPayload.form_id ?? value.form_id;
        const formMap = await loadFormMap(formId);
        const fieldData = leadPayload.field_data ?? [];

        const nome =
          pickField(fieldData, aliasesFor(formMap, "nome")) ?? "Lead Meta";
        const telefoneRaw = pickField(fieldData, aliasesFor(formMap, "telefone"));
        const email = pickField(fieldData, aliasesFor(formMap, "email"));
        const telefone = telefoneRaw ? normalizePhone(telefoneRaw) : null;

        const adId = leadPayload.ad_id ?? value.ad_id ?? null;
        const campaignId = leadPayload.campaign_id ?? value.campaign_id ?? null;
        const cliente = escolherCliente(candidatos, campaignId);
        if (!cliente) {
          await supabase.from("webhook_errors").insert({
            source: "meta_lead",
            payload: { pageId, leadgenId, campaignId },
            error: campaignId
              ? "campanha não liberada para nenhum cliente desta página"
              : "lead sem campaign_id — ignorado até haver allowlist",
          });
          continue;
        }

        const meta = cliente.dados_extras?.meta;
        const attribution = await resolveMetaAttribution(
          accessToken,
          GRAPH_VERSION,
          {
            ad_id: adId,
            campaign_id: campaignId,
            form_id: formId,
            page_id: String(pageId),
            page_name: meta?.page_name,
          },
          attrCache,
        );

        const { data: already } = await supabase
          .from("leads")
          .select("id")
          .eq("meta_leadgen_id", leadgenId)
          .maybeSingle();
        if (already) continue;

        const { data: lead, error: insertError } = await supabase
          .from("leads")
          .insert({
            cliente_id: cliente.id,
            nome,
            telefone,
            email,
            canal: "meta",
            utm_source: "facebook",
            utm_medium: "paid",
            utm_campaign: attribution.meta_campaign_name ?? campaignId,
            status: "novo",
            meta_leadgen_id: leadgenId,
            meta_ad_id: attribution.meta_ad_id,
            meta_ad_name: attribution.meta_ad_name,
            meta_campaign_id: attribution.meta_campaign_id,
            meta_campaign_name: attribution.meta_campaign_name,
            meta_form_id: attribution.meta_form_id,
            meta_form_name: attribution.meta_form_name,
            meta_page_id: attribution.meta_page_id,
            observacoes: null,
          })
          .select("id")
          .single();

        if (insertError) {
          await supabase.from("webhook_errors").insert({
            source: "meta_lead",
            cliente_id: cliente.id,
            payload: { leadgenId, insertError },
            error: insertError.message,
          });
          continue;
        }

        await supabase.from("automation_logs").insert({
          cliente_id: cliente.id,
          action: "meta_lead_captured",
          metadata: {
            lead_id: lead.id,
            leadgen_id: leadgenId,
            page_id: pageId,
            form_id: formId,
            form_name: attribution.meta_form_name,
            ad_id: attribution.meta_ad_id,
            ad_name: attribution.meta_ad_name,
            campaign_id: attribution.meta_campaign_id,
            campaign_name: attribution.meta_campaign_name,
          },
        });

        inseridos += 1;
      }
    }

    return json({ ok: true, inseridos });
  } catch (err) {
    console.error("webhook_meta_lead error", err);
    await supabase.from("webhook_errors").insert({
      source: "meta_lead",
      payload: body,
      error: err instanceof Error ? err.message : String(err),
    });
    return json({ ok: false, error: "handled" }, 200);
  }
});
