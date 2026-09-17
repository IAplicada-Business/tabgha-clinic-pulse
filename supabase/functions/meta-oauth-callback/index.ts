// OAuth Meta Login for Business — troca code por long-lived token e salva no cliente.
//
// GET ?code=&state={cliente_id}::{origin}  (redirect do Facebook)
// Env: META_APP_ID, META_APP_SECRET, META_OAUTH_REDIRECT_URI (opcional),
//      META_OAUTH_SUCCESS_URL, APP_ORIGIN

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  GRAPH_VERSION,
  fetchAdAccounts,
  fetchPages,
  persistClienteMeta,
  toLongLived,
} from "../_shared/meta_connect.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const META_APP_ID = Deno.env.get("META_APP_ID") ?? "";
const META_APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const REDIRECT_URI =
  Deno.env.get("META_OAUTH_REDIRECT_URI") ?? `${SUPABASE_URL}/functions/v1/meta-oauth-callback`;
const SUCCESS_URL = Deno.env.get("META_OAUTH_SUCCESS_URL") ?? "/admin/config-meta?meta=connected";
const ERROR_URL = Deno.env.get("META_OAUTH_ERROR_URL") ?? "/admin/config-meta?meta=error";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function redirect(to: string) {
  return Response.redirect(to, 302);
}

function parseState(raw: string | null) {
  const value = (raw ?? "").trim();
  const [clienteId, origin] = value.split("::");
  return {
    clienteId: (clienteId ?? "").trim(),
    origin: (origin ?? "").trim() || null,
  };
}

function isAllowedOrigin(origin: string) {
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;
    if (url.hostname.endsWith(".lovable.app")) return true;
    if (url.hostname.endsWith(".lovableproject.com")) return true;
    if (url.hostname.includes("tabgha")) return true;
    const configured = Deno.env.get("APP_ORIGIN")?.replace(/\/$/, "");
    if (configured && origin.replace(/\/$/, "") === configured) return true;
    return false;
  } catch {
    return false;
  }
}

function absoluteAppUrl(pathOrUrl: string, req: Request, stateOrigin?: string | null) {
  if (pathOrUrl.startsWith("http")) return pathOrUrl;
  const candidates = [
    stateOrigin && isAllowedOrigin(stateOrigin) ? stateOrigin : null,
    Deno.env.get("APP_ORIGIN"),
    req.headers.get("origin"),
    "https://tabgha-clinic-pulse.lovable.app",
  ].filter((value): value is string => Boolean(value));
  const origin = candidates[0]!.replace(/\/$/, "");
  return `${origin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

async function exchangeCode(code: string) {
  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token` +
    `?client_id=${encodeURIComponent(META_APP_ID)}` +
    `&client_secret=${encodeURIComponent(META_APP_SECRET)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&code=${encodeURIComponent(code)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`token exchange failed: ${await res.text()}`);
  }
  return (await res.json()) as { access_token: string; expires_in?: number };
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const { clienteId, origin: stateOrigin } = parseState(url.searchParams.get("state"));
  const oauthError = url.searchParams.get("error");

  if (oauthError || !code || !clienteId) {
    return redirect(
      absoluteAppUrl(`${ERROR_URL}&reason=${oauthError ?? "missing_code"}`, req, stateOrigin),
    );
  }

  if (!META_APP_ID || !META_APP_SECRET) {
    await supabase.from("webhook_errors").insert({
      source: "meta_oauth",
      cliente_id: clienteId,
      error: "META_APP_ID/META_APP_SECRET não configurados",
    });
    return redirect(absoluteAppUrl(`${ERROR_URL}&reason=missing_app_secrets`, req, stateOrigin));
  }

  try {
    const short = await exchangeCode(code);
    const longLived = await toLongLived(short.access_token);
    const pages = await fetchPages(longLived.access_token);
    const page = pages.length === 1 ? pages[0] : null;
    const adAccounts = await fetchAdAccounts(longLived.access_token);
    const adAccountId = adAccounts.length === 1 ? adAccounts[0].id : null;
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
      : null;

    const saved = await persistClienteMeta(supabase, {
      clienteId,
      userAccessToken: longLived.access_token,
      pageId: page?.id ?? null,
      adAccountId,
      connectedVia: "oauth",
      expiresAt,
    });

    return redirect(
      absoluteAppUrl(
        `${SUCCESS_URL}&page_id=${encodeURIComponent(saved.page_id ?? "")}&cliente_id=${clienteId}`,
        req,
        stateOrigin,
      ),
    );
  } catch (error) {
    console.error("meta-oauth-callback error", error);
    await supabase.from("webhook_errors").insert({
      source: "meta_oauth",
      cliente_id: clienteId,
      error: error instanceof Error ? error.message : String(error),
    });
    return redirect(absoluteAppUrl(`${ERROR_URL}&reason=exchange_failed`, req, stateOrigin));
  }
});
