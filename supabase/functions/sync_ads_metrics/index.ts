import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  campanhasPermitidas,
  filtrarPorCampanha,
  type CampanhaPermitida,
} from "../_shared/meta_campanhas.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

type MetaConfig = {
  access_token?: string;
  user_access_token?: string;
  ad_account_id?: string;
  ad_account_name?: string | null;
  page_name?: string;
  page_id?: string;
  campanhas?: CampanhaPermitida[] | null;
};

type ClienteRow = {
  id: string;
  status?: string;
  dados_extras?: { meta?: MetaConfig } & Record<string, unknown>;
};

type AdAccount = {
  id: string;
  account_id: string;
  name: string;
  amount_spent: number;
  currency?: string;
};

type InsightLevel = "campaign" | "ad" | "account";

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

function parseLeads(
  actions: Array<{ action_type?: string; value?: string }> | null | undefined,
): number {
  const accepted = new Set([
    "lead",
    "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_lead",
  ]);
  return (actions ?? []).reduce((acc, item) => {
    if (item.action_type && accepted.has(item.action_type)) {
      return acc + Number(item.value ?? 0);
    }
    return acc;
  }, 0);
}

function datesBetween(since: string, until: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${since}T00:00:00Z`);
  const end = new Date(`${until}T00:00:00Z`);
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function normalizeAccountId(raw: string): string {
  return raw.replace(/^act_/, "");
}

async function fetchMetaInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string,
  level: InsightLevel,
): Promise<Array<Record<string, unknown>>> {
  const path = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const fields =
    level === "ad"
      ? "campaign_id,campaign_name,ad_id,ad_name,spend,impressions,clicks,actions,action_values,date_start"
      : "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,date_start";
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${path}/insights` +
    `?access_token=${encodeURIComponent(accessToken)}` +
    `&fields=${fields}` +
    `&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}` +
    `&time_increment=1` +
    `&level=${level}` +
    `&limit=500`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Meta API ${response.status} (${level}): ${await response.text()}`);
  }
  const payload = (await response.json()) as {
    data?: Array<Record<string, unknown>>;
  };
  return payload.data ?? [];
}

/**
 * Só o nível "campaign" é usado: o fallback agregado por conta não carrega
 * campaign_id e, numa conta compartilhada, misturaria o gasto de outros
 * clientes na linha de um só.
 */
async function fetchCampaignInsights(
  accessToken: string,
  adAccountId: string,
  since: string,
  until: string,
): Promise<Array<Record<string, unknown>>> {
  return fetchMetaInsights(accessToken, adAccountId, since, until, "campaign");
}

async function listAdAccounts(accessToken: string): Promise<AdAccount[]> {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts` +
    `?fields=id,name,account_id,amount_spent,currency` +
    `&limit=100` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Meta adaccounts ${response.status}: ${await response.text()}`);
  }
  const payload = (await response.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      account_id?: string;
      amount_spent?: string;
      currency?: string;
    }>;
  };

  return (payload.data ?? [])
    .map((row) => {
      const accountId = normalizeAccountId(row.account_id ?? row.id ?? "");
      if (!accountId) return null;
      return {
        id: row.id ?? `act_${accountId}`,
        account_id: accountId,
        name: row.name ?? accountId,
        amount_spent: Number(row.amount_spent ?? 0),
        currency: row.currency,
      } satisfies AdAccount;
    })
    .filter((row): row is AdAccount => Boolean(row));
}

function rankAdAccounts(accounts: AdAccount[], pageName?: string | null): AdAccount[] {
  const page = (pageName ?? "").trim().toLowerCase();
  return [...accounts].sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();
    const aMatch = page && (aName.includes(page) || page.includes(aName)) ? 1 : 0;
    const bMatch = page && (bName.includes(page) || page.includes(bName)) ? 1 : 0;
    if (aMatch !== bMatch) return bMatch - aMatch;
    if (a.amount_spent !== b.amount_spent) return b.amount_spent - a.amount_spent;
    return aName.localeCompare(bName);
  });
}

/** Persists only the linked account id/name — never the full BM catalog. */
async function persistLinkedAdAccount(
  cliente: ClienteRow,
  adAccountId: string,
  accountName?: string | null,
) {
  const extras = { ...(cliente.dados_extras ?? {}) } as Record<string, unknown>;
  const meta = { ...((extras.meta as MetaConfig | undefined) ?? {}) } as Record<string, unknown>;
  meta.ad_account_id = adAccountId;
  meta.ad_account_name =
    accountName ?? (meta.ad_account_name as string | null | undefined) ?? null;
  // Catálogo da BM não deve ir para o cliente (UI / outros sistemas).
  delete meta.ad_accounts;
  delete meta.pages;
  extras.meta = meta;

  const { error } = await supabase
    .from("clientes")
    .update({ dados_extras: extras })
    .eq("id", cliente.id);
  if (error) throw error;

  cliente.dados_extras = extras as ClienteRow["dados_extras"];
}

async function upsertMetrica(
  clienteId: string,
  date: string,
  row: Record<string, unknown>,
  nivel: "campaign" | "ad" | "account",
) {
  const campaign = String(row.campaign_name ?? "Conta Meta").trim() || "Conta Meta";
  const adId = nivel === "ad" ? String(row.ad_id ?? "").trim() : "";
  const anuncio =
    nivel === "ad"
      ? String(row.ad_name ?? "").trim() || (adId ? `Anúncio ${adId}` : null)
      : null;
  const investimento = Number(row.spend ?? 0);
  const leads = parseLeads(
    (row.actions as Array<{ action_type?: string; value?: string }> | undefined) ?? [],
  );
  const impressoes = Math.round(Number(row.impressions ?? 0));
  const cliques = Math.round(Number(row.clicks ?? 0));

  const { error } = await supabase.from("metricas_ads").upsert(
    {
      cliente_id: clienteId,
      data: date,
      plataforma: "meta",
      campanha: campaign,
      ad_id: adId,
      anuncio,
      nivel: nivel === "account" ? "campaign" : nivel,
      investimento,
      leads,
      conversoes: leads,
      impressoes,
      cliques,
      cpl: leads > 0 ? investimento / leads : null,
      cpa: leads > 0 ? investimento / leads : null,
      roas: null,
    },
    { onConflict: "cliente_id,data,plataforma,campanha,ad_id" },
  );

  if (error) throw error;
  return { campanha: campaign, ad_id: adId, investimento, leads, cliques, impressoes };
}

async function syncMetaForClient(cliente: ClienteRow, since: string, until: string) {
  const config = cliente.dados_extras?.meta;
  // Insights de Ads precisam do user token (ads_read). Page token fica para leadgen.
  const accessToken = config?.user_access_token || config?.access_token;
  const adAccountId = config?.ad_account_id ? normalizeAccountId(config.ad_account_id) : null;

  if (!accessToken) {
    return { inseridos: 0, skipped: true, motivo: "meta_not_configured" };
  }

  // Falha fechado: sem campanhas escolhidas para este cliente não se importa
  // nada. Uma conta de anúncio compartilhada entre clientes só pode ser
  // repartida por uma lista explícita.
  const permitidas = campanhasPermitidas(config);
  if (permitidas.size === 0) {
    return {
      inseridos: 0,
      skipped: true,
      motivo: "campanhas_nao_selecionadas",
    };
  }

  try {
    const accounts = await listAdAccounts(accessToken);
    const ranked = rankAdAccounts(accounts, config?.page_name);

    // Escolher a conta sozinho (antes: a de maior gasto da BM) é como a conta
    // da agência acabou vinculada a um cliente. A conta tem de ser explícita.
    if (!adAccountId) {
      return {
        inseridos: 0,
        skipped: true,
        motivo: "ad_account_missing",
        ad_accounts_count: accounts.length,
      };
    }

    const usedAccount = adAccountId;

    // Nunca trocar de conta sozinho: vincular outra conta da BM ao cliente é
    // como o investimento de um acabou no portal de outro.
    if (accounts.length > 0 && !config?.ad_account_name) {
      const linked = ranked.find((a) => a.account_id === usedAccount);
      await persistLinkedAdAccount(cliente, usedAccount, linked?.name);
    }

    const rawCampaignRows = await fetchCampaignInsights(accessToken, usedAccount, since, until);
    const campanhaFiltro = filtrarPorCampanha(rawCampaignRows, permitidas);
    const campaignRows = campanhaFiltro.mantidas;

    let rawAdRows: Array<Record<string, unknown>> = [];
    try {
      rawAdRows = await fetchMetaInsights(accessToken, usedAccount, since, until, "ad");
    } catch (adError) {
      // Conta sem permissão de breakdown por ad — campanhas ainda valem.
      console.warn("meta_ad_insights_failed", adError);
    }
    const adFiltro = filtrarPorCampanha(rawAdRows, permitidas);
    const adRows = adFiltro.mantidas;

    let inseridos = 0;
    for (const row of campaignRows) {
      const date = String(row.date_start ?? since);
      await upsertMetrica(cliente.id, date, row, "campaign");
      inseridos += 1;
    }
    for (const row of adRows) {
      const date = String(row.date_start ?? since);
      if (!String(row.ad_id ?? "").trim()) continue;
      await upsertMetrica(cliente.id, date, row, "ad");
      inseridos += 1;
    }

    const linkedName =
      ranked.find((a) => a.account_id === usedAccount)?.name ?? config?.ad_account_name ?? null;

    await supabase.from("automation_logs").insert({
      cliente_id: cliente.id,
      action: "meta_ads_synced",
      metadata: {
        since,
        until,
        linhas: inseridos,
        campanhas: campaignRows.length,
        anuncios: adRows.length,
        ad_account_id: usedAccount,
        ad_account_name: linkedName,
        campanhas_permitidas: permitidas.size,
        linhas_descartadas: campanhaFiltro.descartadas + adFiltro.descartadas,
        ad_accounts_count: ranked.length,
      },
    });

    return {
      inseridos,
      campanhas: campaignRows.length,
      anuncios: adRows.length,
      since,
      until,
      ad_account_id: usedAccount,
      ad_account_name: linkedName,
      campanhas_permitidas: permitidas.size,
      linhas_descartadas: campanhaFiltro.descartadas + adFiltro.descartadas,
      motivo:
        campaignRows.length === 0 && adRows.length === 0 ? "no_insights_in_range" : undefined,
      ad_accounts_count: ranked.length,
    };
  } catch (error) {
    await supabase.from("webhook_errors").insert({
      source: "meta_ads_sync",
      cliente_id: cliente.id,
      payload: { since, until, retry_in_minutes: 30, max_attempts: 3 },
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      inseridos: 0,
      erro: error instanceof Error ? error.message : String(error),
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true });

  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    let since: string | null = null;
    let until: string | null = null;
    let clienteId: string | null = null;
    let days = 7;

    if (req.method === "POST") {
      try {
        const body = (await req.json()) as {
          date?: string;
          since?: string;
          until?: string;
          days?: number;
          cliente_id?: string;
        };
        if (body.cliente_id) clienteId = body.cliente_id;
        if (body.since && body.until) {
          since = body.since;
          until = body.until;
        } else if (body.date) {
          since = body.date;
          until = body.date;
        } else if (typeof body.days === "number" && body.days > 0) {
          days = Math.min(Math.floor(body.days), 90);
        }
      } catch {
        // body opcional
      }
    }

    if (!since || !until) {
      const end = new Date();
      end.setUTCDate(end.getUTCDate() - 1);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (days - 1));
      since = start.toISOString().slice(0, 10);
      until = end.toISOString().slice(0, 10);
    }

    const dias = datesBetween(since, until).length;

    let query = supabase
      .from("clientes")
      .select("id, status, dados_extras")
      .in("status", ["ativo", "onboarding", "pausa"]);

    if (clienteId) query = query.eq("id", clienteId);

    const { data: clientes, error } = await query;
    if (error) throw error;

    const resultados: Array<Record<string, unknown>> = [];
    for (const cliente of (clientes ?? []) as ClienteRow[]) {
      const meta = cliente.dados_extras?.meta;
      if (!(meta?.user_access_token || meta?.access_token)) {
        resultados.push({
          cliente: cliente.id,
          meta: { skipped: true, motivo: "meta_not_configured" },
        });
        continue;
      }

      const metaResult = await syncMetaForClient(cliente, since, until);
      resultados.push({ cliente: cliente.id, meta: metaResult });
    }

    return json({ ok: true, since, until, dias, resultados });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
});
