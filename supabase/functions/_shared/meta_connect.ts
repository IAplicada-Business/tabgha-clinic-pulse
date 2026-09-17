import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v21.0";
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";

export type MetaPage = {
  id: string;
  name: string;
  access_token?: string;
};

export type MetaAdAccount = {
  id: string;
  name: string;
  amount_spent: number;
  currency?: string;
};

export type MetaMe = {
  id: string;
  name?: string;
};

export type PersistMetaInput = {
  clienteId: string;
  userAccessToken: string;
  pageId?: string | null;
  adAccountId?: string | null;
  connectedVia: "oauth" | "token";
  expiresAt?: string | null;
};

function graphBase(path: string, token: string) {
  const joiner = path.includes("?") ? "&" : "?";
  return `https://graph.facebook.com/${GRAPH_VERSION}/${path}${joiner}access_token=${encodeURIComponent(token)}`;
}

export async function graphGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(graphBase(path, token));
  const payload = (await res.json()) as T & { error?: { message?: string; code?: number } };
  if (!res.ok || payload.error) {
    throw new Error(payload.error?.message ?? `Meta API ${res.status} (${path})`);
  }
  return payload;
}

export function normalizeAccountId(raw: string): string {
  return raw.replace(/^act_/, "").trim();
}

export async function fetchMe(token: string): Promise<MetaMe> {
  return graphGet<MetaMe>("me?fields=id,name", token);
}

async function collectPaged<T extends { id?: string }>(
  path: string,
  token: string,
): Promise<T[]> {
  try {
    const payload = await graphGet<{ data?: T[] }>(path, token);
    return payload.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchPages(token: string): Promise<MetaPage[]> {
  const byId = new Map<string, MetaPage>();
  const paths = [
    "me/accounts?fields=id,name,access_token&limit=100",
    "me/assigned_pages?fields=id,name,access_token&limit=100",
  ];
  for (const path of paths) {
    const rows = await collectPaged<MetaPage>(path, token);
    for (const row of rows) {
      if (!row.id) continue;
      byId.set(row.id, {
        id: row.id,
        name: row.name ?? row.id,
        access_token: row.access_token,
      });
    }
  }
  return [...byId.values()];
}

export async function fetchAdAccounts(token: string): Promise<MetaAdAccount[]> {
  const byId = new Map<string, MetaAdAccount>();
  const paths = [
    "me/adaccounts?fields=id,name,account_id,amount_spent,currency&limit=100",
    "me/assigned_ad_accounts?fields=id,name,account_id,amount_spent,currency&limit=100",
  ];
  for (const path of paths) {
    const rows = await collectPaged<{
      id?: string;
      name?: string;
      account_id?: string;
      amount_spent?: string;
      currency?: string;
    }>(path, token);
    for (const row of rows) {
      const id = normalizeAccountId(row.account_id ?? row.id ?? "");
      if (!id) continue;
      byId.set(id, {
        id,
        name: row.name ?? id,
        amount_spent: Number(row.amount_spent ?? 0),
        currency: row.currency,
      });
    }
  }
  return [...byId.values()];
}

export async function fetchPage(pageId: string, token: string): Promise<MetaPage> {
  return graphGet<MetaPage>(`${pageId}?fields=id,name,access_token`, token);
}

export async function subscribePageLeadgen(pageId: string, pageToken: string) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/${pageId}/subscribed_apps` +
    `?subscribed_fields=leadgen` +
    `&access_token=${encodeURIComponent(pageToken)}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    return { ok: false as const, error: await res.text() };
  }
  return { ok: true as const, payload: await res.json() };
}

export async function toLongLived(shortToken: string) {
  if (!META_APP_ID || !META_APP_SECRET) {
    return { access_token: shortToken, expires_in: undefined as number | undefined };
  }
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
    `?grant_type=fb_exchange_token` +
    `&client_id=${encodeURIComponent(META_APP_ID)}` +
    `&client_secret=${encodeURIComponent(META_APP_SECRET)}` +
    `&fb_exchange_token=${encodeURIComponent(shortToken)}`;
  const res = await fetch(url);
  if (!res.ok) {
    return { access_token: shortToken, expires_in: undefined as number | undefined };
  }
  return (await res.json()) as { access_token: string; expires_in?: number };
}

export async function debugTokenExpiry(inputToken: string): Promise<string | null> {
  if (!META_APP_ID || !META_APP_SECRET) return null;
  try {
    const payload = await graphGet<{
      data?: { expires_at?: number; data_access_expires_at?: number };
    }>(
      `debug_token?input_token=${encodeURIComponent(inputToken)}`,
      `${META_APP_ID}|${META_APP_SECRET}`,
    );
    const expiresAt = payload.data?.expires_at;
    if (!expiresAt || expiresAt === 0) return null;
    return new Date(expiresAt * 1000).toISOString();
  } catch {
    return null;
  }
}

export async function persistClienteMeta(
  supabase: SupabaseClient,
  input: PersistMetaInput,
) {
  const pages = await fetchPages(input.userAccessToken);
  const adAccounts = await fetchAdAccounts(input.userAccessToken);
  const requestedPageId = input.pageId?.trim() || "";
  let page = requestedPageId ? (pages.find((p) => p.id === requestedPageId) ?? null) : null;
  if (requestedPageId) {
    try {
      const fetched = await fetchPage(requestedPageId, input.userAccessToken);
      page = {
        id: fetched.id,
        name: fetched.name ?? page?.name ?? fetched.id,
        access_token: fetched.access_token ?? page?.access_token,
      };
    } catch (error) {
      if (!page) throw error;
    }
  }
  const pageToken = page?.access_token ?? input.userAccessToken;
  const adAccountId = input.adAccountId ? normalizeAccountId(input.adAccountId) : null;
  const selectedAdAccount = adAccountId
    ? (adAccounts.find((a) => a.id === adAccountId) ?? { id: adAccountId, name: adAccountId, amount_spent: 0 })
    : null;

  let leadgenSubscribe: { ok: boolean; error?: string } | null = null;
  if (page?.id && page.access_token) {
    const sub = await subscribePageLeadgen(page.id, page.access_token);
    leadgenSubscribe = sub.ok
      ? { ok: true }
      : { ok: false, error: "error" in sub ? sub.error : "subscribe_failed" };
  }

  const { data: cliente, error: clienteError } = await supabase
    .from("clientes")
    .select("id, dados_extras")
    .eq("id", input.clienteId)
    .maybeSingle();

  if (clienteError || !cliente) {
    throw new Error("cliente_not_found");
  }

  const extras = (cliente.dados_extras as Record<string, unknown> | null) ?? {};
  const prevMeta = {
    ...((extras.meta as Record<string, unknown> | undefined) ?? {}),
  };
  delete prevMeta.ad_accounts;
  delete prevMeta.pages;

  const keepPreviousPage = !requestedPageId;
  const keepPreviousAccount = !adAccountId;
  const nextExtras = {
    ...extras,
    meta: {
      ...prevMeta,
      access_token: pageToken,
      user_access_token: input.userAccessToken,
      page_id: page?.id ?? (keepPreviousPage ? (prevMeta.page_id as string | null) ?? null : null),
      page_name: page?.name ?? (keepPreviousPage ? (prevMeta.page_name as string | null) ?? null : null),
      ad_account_id:
        selectedAdAccount?.id ??
        adAccountId ??
        (keepPreviousAccount ? (prevMeta.ad_account_id as string | null) ?? null : null),
      ad_account_name:
        selectedAdAccount?.name ??
        (keepPreviousAccount ? (prevMeta.ad_account_name as string | null) ?? null : null),
      leadgen_subscribed: leadgenSubscribe?.ok ?? (prevMeta.leadgen_subscribed as boolean | undefined) ?? false,
      expires_at: input.expiresAt ?? (prevMeta.expires_at as string | null) ?? null,
      connected_at: new Date().toISOString(),
      connected_via: input.connectedVia,
    },
  };

  const saved = nextExtras.meta as {
    page_id?: string | null;
    page_name?: string | null;
    ad_account_id?: string | null;
    ad_account_name?: string | null;
    leadgen_subscribed?: boolean;
    expires_at?: string | null;
  };

  const { error: updateError } = await supabase
    .from("clientes")
    .update({ dados_extras: nextExtras })
    .eq("id", input.clienteId);

  if (updateError) throw updateError;

  await supabase.from("automation_logs").insert({
    cliente_id: input.clienteId,
    action: "meta_oauth_connected",
    metadata: {
      page_id: saved.page_id ?? null,
      page_name: saved.page_name ?? null,
      ad_account_id: saved.ad_account_id ?? null,
      ad_account_name: saved.ad_account_name ?? null,
      ad_accounts_count: adAccounts.length,
      leadgen_subscribed: saved.leadgen_subscribed ?? false,
      leadgen_subscribe_error: leadgenSubscribe?.ok === false ? leadgenSubscribe.error : null,
      expires_at: saved.expires_at ?? null,
      connected_via: input.connectedVia,
    },
  });

  if (leadgenSubscribe && !leadgenSubscribe.ok) {
    await supabase.from("webhook_errors").insert({
      source: "meta_oauth",
      cliente_id: input.clienteId,
      payload: { page_id: saved.page_id, step: "leadgen_subscribe" },
      error: leadgenSubscribe.error ?? "subscribe_failed",
    });
  }

  return {
    page_id: saved.page_id ?? null,
    page_name: saved.page_name ?? null,
    ad_account_id: saved.ad_account_id ?? null,
    ad_account_name: saved.ad_account_name ?? null,
    leadgen_subscribed: saved.leadgen_subscribed ?? false,
    expires_at: saved.expires_at ?? null,
  };
}
