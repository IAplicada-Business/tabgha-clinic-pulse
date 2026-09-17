// Valida um token Meta (user ou System User) e grava no cliente.
//
// POST { action: "inspect", access_token }
// POST { action: "save", cliente_id, access_token, page_id, ad_account_id? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  debugTokenExpiry,
  fetchAdAccounts,
  fetchMe,
  fetchPages,
  persistClienteMeta,
  toLongLived,
} from "../_shared/meta_connect.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const STAFF_ROLES = new Set([
  "admin",
  "gestor_estrategico",
  "growth_manager",
  "performance",
]);

const cors = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}

async function assertStaff(authHeader: string) {
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false as const, response: json({ ok: false, error: "unauthorized" }, 401) };
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return { ok: false as const, response: json({ ok: false, error: "unauthorized" }, 401) };
  }
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id);
  const allowed = (roles ?? []).some((row) => STAFF_ROLES.has(String(row.role)));
  if (!allowed) {
    return { ok: false as const, response: json({ ok: false, error: "sem permissão Meta Ads" }, 403) };
  }
  return { ok: true as const, userId: userData.user.id };
}

async function loadSavedToken(clienteId: string | undefined) {
  if (!clienteId) return "";
  const { data } = await admin
    .from("clientes")
    .select("dados_extras")
    .eq("id", clienteId)
    .maybeSingle();
  const meta = (data?.dados_extras as { meta?: { access_token?: string; user_access_token?: string } } | null)
    ?.meta;
  return (meta?.user_access_token || meta?.access_token || "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const caller = await assertStaff(req.headers.get("Authorization") ?? "");
  if (!caller.ok) return caller.response;

  try {
    const body = (await req.json()) as {
      action?: "inspect" | "save";
      access_token?: string;
      cliente_id?: string;
      page_id?: string;
      ad_account_id?: string;
    };

    const tokenFromBody = (body.access_token ?? "").trim();
    const token = tokenFromBody || (await loadSavedToken(body.cliente_id));
    if (!token) return json({ ok: false, error: "access_token obrigatório" }, 400);

    const me = await fetchMe(token);
    const pages = await fetchPages(token);
    const adAccounts = await fetchAdAccounts(token);

    if (body.action === "inspect" || !body.action) {
      const expiresAt = await debugTokenExpiry(token);
      return json({
        ok: true,
        me,
        pages: pages.map((p) => ({ id: p.id, name: p.name })),
        ad_accounts: adAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          amount_spent: a.amount_spent,
        })),
        expires_at: expiresAt,
      });
    }

    if (body.action !== "save") {
      return json({ ok: false, error: "action inválida" }, 400);
    }
    if (!body.cliente_id) return json({ ok: false, error: "cliente_id obrigatório" }, 400);
    if (!body.page_id) return json({ ok: false, error: "page_id obrigatório" }, 400);

    const longLived = await toLongLived(token);
    const expiresAt =
      longLived.expires_in != null
        ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
        : await debugTokenExpiry(longLived.access_token);

    const saved = await persistClienteMeta(admin, {
      clienteId: body.cliente_id,
      userAccessToken: longLived.access_token,
      pageId: body.page_id.trim(),
      adAccountId: body.ad_account_id?.trim() || null,
      connectedVia: "token",
      expiresAt,
    });

    return json({ ok: true, me, ...saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ ok: false, error: message });
  }
});
