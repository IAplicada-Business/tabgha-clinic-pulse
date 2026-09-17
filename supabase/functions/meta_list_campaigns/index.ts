// Lista campanhas da Ad Account vinculada ao cliente para o admin marcar a allowlist.
// Body: { cliente_id: string, days?: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v21.0";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const STAFF_ROLES = new Set([
  "super_admin",
  "admin",
  "gestor_estrategico",
  "growth_manager",
  "performance",
]);

type MetaConfig = {
  access_token?: string;
  user_access_token?: string;
  ad_account_id?: string;
  campanhas?: Array<{ id: string; nome?: string | null }> | null;
};

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
  return { ok: true as const };
}

function normalizeAccountId(raw: string): string {
  return raw.replace(/^act_/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const guard = await assertStaff(req.headers.get("Authorization") ?? "");
  if (!guard.ok) return guard.response;

  try {
    const body = (await req.json()) as { cliente_id?: string; days?: number };
    const clienteId = body.cliente_id;
    if (!clienteId) return json({ ok: false, error: "cliente_id obrigatório" });

    const days = Math.min(Math.max(Number(body.days ?? 90), 1), 365);

    const { data: cliente, error } = await admin
      .from("clientes")
      .select("id, dados_extras")
      .eq("id", clienteId)
      .single();
    if (error) throw error;

    const config = (cliente.dados_extras as { meta?: MetaConfig } | null)?.meta;
    const accessToken = config?.user_access_token || config?.access_token;
    if (!accessToken) return json({ ok: false, error: "meta_not_configured" });
    if (!config?.ad_account_id) return json({ ok: false, error: "ad_account_missing" });

    const account = `act_${normalizeAccountId(config.ad_account_id)}`;
    const until = new Date();
    const since = new Date(until.getTime() - days * 86_400_000);
    const timeRange = JSON.stringify({
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    });

    const campaignsUrl =
      `https://graph.facebook.com/${GRAPH_VERSION}/${account}/campaigns` +
      `?access_token=${encodeURIComponent(accessToken)}` +
      `&fields=id,name,status,effective_status` +
      `&limit=200` +
      `&filtering=${encodeURIComponent(
        JSON.stringify([
          {
            field: "effective_status",
            operator: "IN",
            value: ["ACTIVE", "PAUSED", "CAMPAIGN_PAUSED", "IN_PROCESS", "WITH_ISSUES"],
          },
        ]),
      )}`;

    const insightsUrl =
      `https://graph.facebook.com/${GRAPH_VERSION}/${account}/insights` +
      `?access_token=${encodeURIComponent(accessToken)}` +
      `&fields=campaign_id,campaign_name,spend` +
      `&time_range=${encodeURIComponent(timeRange)}` +
      `&level=campaign&limit=500`;

    const [campaignsRes, insightsRes] = await Promise.all([
      fetch(campaignsUrl),
      fetch(insightsUrl),
    ]);

    if (!insightsRes.ok && !campaignsRes.ok) {
      const text = await insightsRes.text();
      return json({ ok: false, error: `Meta API ${insightsRes.status}: ${text.slice(0, 300)}` });
    }

    const campaignsPayload = campaignsRes.ok
      ? ((await campaignsRes.json()) as {
          data?: Array<{ id?: string; name?: string; status?: string; effective_status?: string }>;
        })
      : { data: [] };
    const insightsPayload = insightsRes.ok
      ? ((await insightsRes.json()) as {
          data?: Array<{ campaign_id?: string; campaign_name?: string; spend?: string }>;
        })
      : { data: [] };

    const agregado = new Map<
      string,
      { id: string; nome: string; investimento: number; status?: string }
    >();

    for (const row of campaignsPayload.data ?? []) {
      const id = String(row.id ?? "").trim();
      if (!id) continue;
      agregado.set(id, {
        id,
        nome: row.name ?? id,
        investimento: 0,
        status: row.effective_status ?? row.status,
      });
    }

    for (const row of insightsPayload.data ?? []) {
      const id = String(row.campaign_id ?? "").trim();
      if (!id) continue;
      const atual = agregado.get(id) ?? {
        id,
        nome: row.campaign_name ?? id,
        investimento: 0,
      };
      atual.investimento += Number(row.spend ?? 0);
      if (!atual.nome || atual.nome === id) atual.nome = row.campaign_name ?? atual.nome;
      agregado.set(id, atual);
    }

    for (const salva of config.campanhas ?? []) {
      const id = String(salva?.id ?? "").trim();
      if (!id || agregado.has(id)) continue;
      agregado.set(id, { id, nome: salva.nome ?? id, investimento: 0 });
    }

    const selecionadas = new Set(
      (config.campanhas ?? []).map((c) => String(c?.id ?? "").trim()).filter(Boolean),
    );

    const campanhas = [...agregado.values()]
      .map((c) => ({ ...c, selecionada: selecionadas.has(c.id) }))
      .sort((a, b) => b.investimento - a.investimento);

    return json({ ok: true, campanhas, ad_account_id: config.ad_account_id, days });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});
