// Lista as campanhas da conta de anúncio vinculada a um cliente, para que o
// admin escolha quais pertencem a ele (allowlist em dados_extras.meta.campanhas).
//
// Body: { cliente_id: string, days?: number }
// Só super admin: a resposta expõe o catálogo de campanhas da BM.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const GRAPH_VERSION = Deno.env.get("META_GRAPH_VERSION") ?? "v19.0";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

type MetaConfig = {
  access_token?: string;
  user_access_token?: string;
  ad_account_id?: string;
  campanhas?: Array<{ id: string; nome?: string | null }> | null;
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

async function assertCallerIsAdmin(authHeader: string) {
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
  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "super_admin",
  });
  if (roleErr || !isAdmin) {
    return { ok: false as const, response: json({ ok: false, error: "apenas super admin" }, 403) };
  }
  return { ok: true as const };
}

function normalizeAccountId(raw: string): string {
  return raw.replace(/^act_/, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const guard = await assertCallerIsAdmin(req.headers.get("Authorization") ?? "");
  if (!guard.ok) return guard.response;

  try {
    const body = (await req.json()) as { cliente_id?: string; days?: number };
    const clienteId = body.cliente_id;
    if (!clienteId) return json({ ok: false, error: "cliente_id obrigatório" }, 400);

    const days = Math.min(Math.max(Number(body.days ?? 90), 1), 365);

    const { data: cliente, error } = await admin
      .from("clientes")
      .select("id, dados_extras")
      .eq("id", clienteId)
      .single();
    if (error) throw error;

    const config = (cliente.dados_extras as { meta?: MetaConfig } | null)?.meta;
    const accessToken = config?.user_access_token || config?.access_token;
    if (!accessToken) return json({ ok: false, error: "meta_not_configured" }, 400);
    if (!config?.ad_account_id) return json({ ok: false, error: "ad_account_missing" }, 400);

    const account = `act_${normalizeAccountId(config.ad_account_id)}`;
    const until = new Date();
    const since = new Date(until.getTime() - days * 86_400_000);
    const timeRange = JSON.stringify({
      since: since.toISOString().slice(0, 10),
      until: until.toISOString().slice(0, 10),
    });

    // Insights por campanha no período: dá nome, id e gasto — o gasto ajuda a
    // reconhecer quais campanhas são mesmo do cliente na hora de marcar.
    const url =
      `https://graph.facebook.com/${GRAPH_VERSION}/${account}/insights` +
      `?access_token=${encodeURIComponent(accessToken)}` +
      `&fields=campaign_id,campaign_name,spend` +
      `&time_range=${encodeURIComponent(timeRange)}` +
      `&level=campaign&limit=500`;

    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text();
      return json({ ok: false, error: `Meta API ${response.status}: ${text.slice(0, 300)}` }, 200);
    }

    const payload = (await response.json()) as {
      data?: Array<{ campaign_id?: string; campaign_name?: string; spend?: string }>;
    };

    const agregado = new Map<string, { id: string; nome: string; investimento: number }>();
    for (const row of payload.data ?? []) {
      const id = String(row.campaign_id ?? "").trim();
      if (!id) continue;
      const atual = agregado.get(id) ?? {
        id,
        nome: row.campaign_name ?? id,
        investimento: 0,
      };
      atual.investimento += Number(row.spend ?? 0);
      agregado.set(id, atual);
    }

    const selecionadas = new Set(
      (config.campanhas ?? []).map((c) => String(c?.id ?? "").trim()).filter(Boolean),
    );

    const campanhas = [...agregado.values()]
      .map((c) => ({ ...c, selecionada: selecionadas.has(c.id) }))
      .sort((a, b) => b.investimento - a.investimento);

    return json({ ok: true, campanhas, ad_account_id: config.ad_account_id, days });
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 200);
  }
});
