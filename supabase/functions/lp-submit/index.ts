// Landing page "quero saber mais" — captura pública com honeypot + rate limit.
//
// POST { nome, telefone, especialidade?, cidade?, website?, utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?, email? }
// CORS aberto. Sem service_role no cliente.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TABGHA_CLIENTE_ID =
  Deno.env.get("TABGHA_CLIENTE_ID") ?? "00000000-0000-0000-0000-000000000001";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

async function rateLimited(ip: string) {
  const key = `lp:${ip}`;
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString();

  const { data } = await supabase
    .from("phone_cache")
    .select("telefone, checked_at")
    .eq("telefone", key)
    .maybeSingle();

  if (data && data.checked_at >= cutoff) {
    return true;
  }

  await supabase.from("phone_cache").upsert({
    telefone: key,
    exists: true,
    checked_at: new Date().toISOString(),
  });

  return false;
}

type Payload = {
  nome?: string;
  telefone?: string;
  email?: string;
  especialidade?: string;
  cidade?: string;
  volume_estimado?: string;
  website?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  // Honeypot: bots preenchem "website" — silencia
  if (payload.website && payload.website.trim() !== "") {
    return json({ ok: true });
  }

  const nome = payload.nome?.trim() ?? "";
  const telefone = payload.telefone ? normalizePhone(payload.telefone) : "";
  const email = payload.email?.trim() || null;

  if (!nome || (!telefone && !email)) {
    return json({ ok: false, error: "missing_fields" }, 400);
  }

  const ip = clientIp(req);
  if (await rateLimited(ip)) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  try {
    const especialidade = payload.especialidade?.trim() || null;
    const cidade = payload.cidade?.trim() || null;
    const volume = payload.volume_estimado?.trim() || null;

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        cliente_id: TABGHA_CLIENTE_ID,
        nome,
        telefone: telefone || null,
        email,
        canal: "lp",
        utm_source: payload.utm_source ?? "direct",
        utm_medium: payload.utm_medium ?? null,
        utm_campaign: payload.utm_campaign ?? null,
        utm_content: payload.utm_content ?? null,
        utm_term: payload.utm_term ?? null,
        status: "novo",
        observacoes: [
          especialidade ? `especialidade: ${especialidade}` : null,
          cidade ? `cidade: ${cidade}` : null,
          volume ? `volume: ${volume}` : null,
        ]
          .filter(Boolean)
          .join(" | ") || null,
      })
      .select("id")
      .single();

    if (error) throw error;

    await supabase.from("automation_logs").insert({
      cliente_id: TABGHA_CLIENTE_ID,
      action: "lp_lead_captured",
      metadata: { lead_id: lead.id, ip, especialidade, cidade, volume },
    });

    return json({ ok: true, lead_id: lead.id });
  } catch (error) {
    console.error("lp-submit error", error);
    await supabase.from("webhook_errors").insert({
      source: "lp_submit",
      payload,
      error: error instanceof Error ? error.message : String(error),
    });
    return json({ ok: false, error: "submit_failed" }, 500);
  }
});
