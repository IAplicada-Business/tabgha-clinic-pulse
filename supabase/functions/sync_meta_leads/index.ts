// Importa leads históricos dos formulários Lead Ads da Meta para a tabela leads.
// Body opcional: { cliente_id?: string, days?: number }
// Usa page_id + access_token em dados_extras.meta.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { campanhaLiberada, campanhasPermitidas } from "../_shared/meta_campanhas.ts";
import {
  createAttributionCache,
  resolveMetaAttribution,
  type MetaAttribution,
} from "../_shared/meta_lead_attribution.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";
const RUN_BUDGET_MS = 45_000;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type FieldData = { name?: string; values?: string[] };
type FormMap = Record<string, string[] | string>;

type MetaConfig = {
  access_token?: string;
  user_access_token?: string;
  page_id?: string;
  page_name?: string;
  campanhas?: Array<{ id: string; nome?: string | null }> | null;
};

type GraphLead = {
  id: string;
  created_time?: string;
  ad_id?: string;
  campaign_id?: string;
  form_id?: string;
  field_data?: FieldData[];
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function pickField(fieldData: FieldData[], aliases: string[]): string[] {
  const lowered = aliases.map((a) => a.toLowerCase());
  const out: string[] = [];
  for (const field of fieldData) {
    const name = (field.name ?? "").toLowerCase();
    if (lowered.includes(name)) {
      const value = field.values?.[0]?.trim();
      if (value) out.push(value);
    }
  }
  return out;
}

function pickOne(fieldData: FieldData[], aliases: string[]): string | null {
  return pickField(fieldData, aliases)[0] ?? null;
}

function aliasesFor(map: FormMap, key: string): string[] {
  const raw = map[key];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

async function loadFormMap(formId: string | undefined): Promise<FormMap> {
  const { data } = await supabase
    .from("app_config")
    .select("valor")
    .eq("chave", "meta_form_map")
    .maybeSingle();

  const maps = (data?.valor ?? {}) as Record<string, FormMap>;
  if (formId && maps[formId]) return maps[formId];
  return (
    maps._default ?? {
      nome: ["full_name", "name", "nome"],
      telefone: ["phone_number", "phone", "telefone"],
      email: ["email"],
    }
  );
}

async function graphGet<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Meta API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function fetchAllPages<T extends { id?: string }>(
  firstUrl: string,
  deadline: number,
): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = firstUrl;
  let guard = 0;
  while (url && guard < 40) {
    if (Date.now() > deadline) break;
    guard += 1;
    const payload = await graphGet<{ data?: T[]; paging?: { next?: string } }>(url);
    out.push(...(payload.data ?? []));
    url = payload.paging?.next ?? null;
  }
  return out;
}

const STALE_LEAD_MS = 3 * 24 * 60 * 60 * 1000;

// Leads sincronizados que já nasceram "velhos" (backfill) não devem entrar no
// cold_followup do nurture-tick — senão o CRM manda WhatsApp de "lead frio"
// para alguém que preencheu o formulário há semanas/meses.
async function suppressColdFollowupIfStale(
  leadId: string,
  clienteId: string,
  createdTime?: string,
) {
  const createdMs = createdTime ? Date.parse(createdTime) : NaN;
  if (!Number.isFinite(createdMs) || Date.now() - createdMs < STALE_LEAD_MS) return;
  // kind cold_followup foi migrado para seq_b; insert antigo dava 400 e atrasava o backfill.
  const { error } = await supabase.from("nurture_jobs").insert({
    cliente_id: clienteId,
    lead_id: leadId,
    kind: "seq_b",
    step: 0,
    status: "done",
    next_run_at: new Date().toISOString(),
    metadata: { reason: "backfill_stale_lead_suppressed" },
  });
  if (error) console.warn("nurture_jobs suppress skipped", error.message);
}

function attributionFromPayload(
  lead: GraphLead,
  form: { id: string; name?: string },
  pageId: string,
  campanhaNomes: Map<string, string | null>,
): MetaAttribution {
  const campaignId = lead.campaign_id ? String(lead.campaign_id) : null;
  return {
    meta_ad_id: lead.ad_id ?? null,
    meta_ad_name: null,
    meta_campaign_id: campaignId,
    meta_campaign_name: campaignId ? (campanhaNomes.get(campaignId) ?? null) : null,
    meta_form_id: lead.form_id ?? form.id,
    meta_form_name: form.name ?? null,
    meta_page_id: pageId,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let body: { cliente_id?: string; days?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const days = Math.min(Math.max(Number(body.days) || 90, 1), 365);
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const sinceUnix = Math.floor(sinceMs / 1000);
  const deadline = Date.now() + RUN_BUDGET_MS;
  const timeFilter = encodeURIComponent(
    JSON.stringify([{ field: "time_created", operator: "GREATER_THAN", value: sinceUnix }]),
  );

  let clientesQ = supabase.from("clientes").select("id, nome, dados_extras");
  if (body.cliente_id) clientesQ = clientesQ.eq("id", body.cliente_id);

  const { data: clientes, error: clientesError } = await clientesQ;
  if (clientesError) return json({ ok: false, error: clientesError.message }, 500);

  const resultados: Array<Record<string, unknown>> = [];
  const formMapDefault = await loadFormMap(undefined);

  for (const cliente of clientes ?? []) {
    const meta = (cliente.dados_extras as { meta?: MetaConfig } | null)?.meta;
    const pageId = meta?.page_id;
    const tokens = [meta?.user_access_token, meta?.access_token].filter(
      (t): t is string => Boolean(t),
    );
    if (!pageId || tokens.length === 0) {
      resultados.push({
        cliente_id: cliente.id,
        nome: cliente.nome,
        skipped: true,
        motivo: "meta_page_or_token_missing",
      });
      continue;
    }

    const permitidas = campanhasPermitidas(meta);
    if (permitidas.size === 0) {
      resultados.push({
        cliente_id: cliente.id,
        nome: cliente.nome,
        skipped: true,
        motivo: "campanhas_nao_selecionadas",
      });
      continue;
    }

    const campanhaNomes = new Map(
      (meta?.campanhas ?? []).map((c) => [String(c.id), c.nome ?? null] as const),
    );

    try {
      let forms: Array<{
        id: string;
        name?: string;
        status?: string;
        leads_count?: number;
      }> = [];
      let token = tokens[0];
      let lastFormsError: string | null = null;

      for (const candidate of tokens) {
        try {
          const formsUrl =
            `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/leadgen_forms` +
            `?fields=id,name,status,leads_count` +
            `&access_token=${encodeURIComponent(candidate)}` +
            `&limit=100`;
          forms = await fetchAllPages(formsUrl, deadline);
          token = candidate;
          lastFormsError = null;
          break;
        } catch (err) {
          lastFormsError = err instanceof Error ? err.message : String(err);
        }
      }

      if (lastFormsError) {
        throw new Error(lastFormsError);
      }

      let inseridos = 0;
      let atualizados = 0;
      let ignorados = 0;
      let erros = 0;
      let truncated = false;
      const formErrors: string[] = [];
      const attrCache = createAttributionCache();

      for (const form of forms) {
        if (Date.now() > deadline) {
          truncated = true;
          break;
        }
        if (!form.id) continue;
        const status = (form.status ?? "").toUpperCase();
        if (status === "ARCHIVED" || status === "DELETED" || status === "DRAFT") continue;
        try {
          const leadsUrl =
            `https://graph.facebook.com/${GRAPH_VERSION}/${form.id}/leads` +
            `?fields=created_time,id,ad_id,campaign_id,field_data,form_id` +
            `&access_token=${encodeURIComponent(token)}` +
            `&filtering=${timeFilter}` +
            `&limit=100`;

          let leads: GraphLead[] = [];
          try {
            leads = await fetchAllPages<GraphLead>(leadsUrl, deadline);
          } catch {
            const fallbackUrl =
              `https://graph.facebook.com/${GRAPH_VERSION}/${form.id}/leads` +
              `?fields=created_time,id,ad_id,campaign_id,field_data,form_id` +
              `&access_token=${encodeURIComponent(token)}` +
              `&limit=100`;
            leads = await fetchAllPages<GraphLead>(fallbackUrl, deadline);
          }
          const formMap = await loadFormMap(form.id);
          const aliases = Object.keys(formMap).length ? formMap : formMapDefault;

          for (const lead of leads) {
            if (Date.now() > deadline) {
              truncated = true;
              break;
            }
            if (!lead.id) continue;
            const created = lead.created_time ? Date.parse(lead.created_time) : Date.now();
            if (Number.isFinite(created) && created < sinceMs) {
              ignorados += 1;
              continue;
            }

            const { data: existing } = await supabase
              .from("leads")
              .select("id, cliente_id")
              .eq("meta_leadgen_id", lead.id)
              .maybeSingle();

            if (existing) {
              ignorados += 1;
              continue;
            }

            let attribution = attributionFromPayload(lead, form, pageId, campanhaNomes);
            if (!attribution.meta_campaign_id) {
              attribution = await resolveMetaAttribution(
                token,
                GRAPH_VERSION,
                {
                  ad_id: lead.ad_id,
                  campaign_id: lead.campaign_id,
                  form_id: lead.form_id ?? form.id,
                  form_name: form.name,
                  page_id: pageId,
                  page_name: meta?.page_name,
                },
                attrCache,
              );
            }

            const campaignId = attribution.meta_campaign_id ?? lead.campaign_id ?? null;
            if (!campanhaLiberada(campaignId, permitidas)) {
              ignorados += 1;
              continue;
            }

            const fieldData = lead.field_data ?? [];
            const nome =
              pickOne(fieldData, aliasesFor(aliases, "nome")) ?? "Lead Meta";
            const telefoneRaw = pickOne(fieldData, aliasesFor(aliases, "telefone"));
            const email = pickOne(fieldData, aliasesFor(aliases, "email"));
            const telefone = telefoneRaw ? normalizePhone(telefoneRaw) : null;

            const { data: inserted, error: insertError } = await supabase
              .from("leads")
              .insert({
                cliente_id: cliente.id,
                nome,
                telefone,
                email,
                canal: "meta",
                utm_source: "facebook",
                utm_medium: "paid",
                utm_campaign: attribution.meta_campaign_name ?? lead.campaign_id ?? null,
                status: "novo",
                meta_leadgen_id: lead.id,
                meta_ad_id: attribution.meta_ad_id,
                meta_ad_name: attribution.meta_ad_name,
                meta_campaign_id: attribution.meta_campaign_id,
                meta_campaign_name: attribution.meta_campaign_name,
                meta_form_id: attribution.meta_form_id,
                meta_form_name: attribution.meta_form_name,
                meta_page_id: attribution.meta_page_id,
                criado_em: lead.created_time ?? new Date().toISOString(),
                observacoes: null,
              })
              .select("id")
              .single();

            if (insertError) {
              erros += 1;
              formErrors.push(`${form.id}: ${insertError.message}`);
              continue;
            }

            await suppressColdFollowupIfStale(inserted.id, cliente.id, lead.created_time);
            inseridos += 1;
          }
        } catch (formErr) {
          erros += 1;
          formErrors.push(
            `${form.id}: ${formErr instanceof Error ? formErr.message : String(formErr)}`,
          );
        }
      }

      resultados.push({
        cliente_id: cliente.id,
        nome: cliente.nome,
        forms: forms.length,
        inseridos,
        atualizados,
        ignorados,
        erros,
        truncated,
        formErrors: formErrors.slice(0, 5),
      });
    } catch (err) {
      resultados.push({
        cliente_id: cliente.id,
        nome: cliente.nome,
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return json({ ok: true, days, resultados });
});
