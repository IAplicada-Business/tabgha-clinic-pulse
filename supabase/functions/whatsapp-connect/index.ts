// Self-service WhatsApp (Z-API): status + QR + disconnect.
//
// POST { action: 'status'|'qr'|'disconnect', cliente_id? }
// Auth: service_role OU JWT (admin/cliente do próprio cliente_id)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY =
  Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type InstanceRow = {
  id: string;
  cliente_id: string;
  provider: string;
  instance_id: string | null;
  token: string | null;
  phone: string | null;
  status: string;
  dados_extras: Record<string, unknown> | null;
  last_connected_at: string | null;
};

function zapiBase(inst: InstanceRow) {
  const extras = (inst.dados_extras ?? {}) as { base_url?: string; client_token?: string };
  return {
    baseUrl: extras.base_url ?? "https://api.z-api.io",
    clientToken: extras.client_token ?? Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "",
  };
}

async function zapiGet(inst: InstanceRow, path: string) {
  if (!inst.instance_id || !inst.token) {
    throw new Error(
      "instance_id/token não configurados — peça à Tabgha para provisionar a instância",
    );
  }
  const { baseUrl, clientToken } = zapiBase(inst);
  const url = `${baseUrl}/instances/${inst.instance_id}/token/${inst.token}/${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (clientToken) headers["Client-Token"] = clientToken;

  const res = await fetch(url, { headers });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Z-API ${res.status}: ${text}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const isServiceRole = token === SERVICE_KEY;

  let callerRole: string | null = null;
  let callerClienteId: string | null = null;

  if (!isServiceRole) {
    if (!ANON_KEY) return json({ ok: false, error: "anon_key_missing" }, 500);
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ ok: false, error: "unauthorized" }, 401);

    // Um usuário pode ter equipe + portal; maybeSingle() dava erro nesse caso.
    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", user.id),
      admin.from("profiles").select("cliente_id").eq("id", user.id).maybeSingle(),
    ]);
    const papeis = (roleRows ?? []).map((r) => r.role as string);
    callerRole = papeis.includes("super_admin")
      ? "super_admin"
      : papeis.includes("cliente")
        ? "cliente"
        : null;
    callerClienteId = profile?.cliente_id ?? null;
    if (!callerRole) {
      return json({ ok: false, error: "forbidden" }, 403);
    }
  }

  let body: { action?: string; cliente_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const action = body.action ?? "status";
  let clienteId = body.cliente_id ?? null;
  if (!clienteId && callerRole === "cliente") clienteId = callerClienteId;
  if (!clienteId) return json({ ok: false, error: "missing_cliente_id" }, 400);

  if (!isServiceRole && callerRole === "cliente" && callerClienteId !== clienteId) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  try {
    const { data: instance, error } = await admin
      .from("whatsapp_instances")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!instance) {
      return json({
        ok: true,
        provisioned: false,
        status: "disconnected",
        message:
          "Nenhuma instância provisionada. A Tabgha precisa criar a instância Z-API deste cliente.",
      });
    }

    const inst = instance as InstanceRow;

    if (action === "status") {
      let connected = inst.status === "connected";
      let phone = inst.phone;
      let zapiStatus: Record<string, unknown> | null = null;

      if (inst.instance_id && inst.token) {
        try {
          zapiStatus = await zapiGet(inst, "status");
          const connectedFlag =
            zapiStatus.connected === true ||
            zapiStatus.smartphoneConnected === true ||
            String(zapiStatus.connectionState ?? "").toLowerCase() === "connected";
          connected = Boolean(connectedFlag);
          if (typeof zapiStatus.phone === "string") phone = zapiStatus.phone;

          await admin
            .from("whatsapp_instances")
            .update({
              status: connected ? "connected" : "connecting",
              phone,
              last_connected_at: connected ? new Date().toISOString() : inst.last_connected_at,
            })
            .eq("id", inst.id);
        } catch (err) {
          // Mantém status local se Z-API falhar
          console.error("status check failed", err);
        }
      }

      return json({
        ok: true,
        provisioned: true,
        instance_id: inst.instance_id,
        status: connected ? "connected" : inst.status,
        phone,
        zapi: zapiStatus,
      });
    }

    if (action === "qr") {
      await admin.from("whatsapp_instances").update({ status: "connecting" }).eq("id", inst.id);
      const qr = await zapiGet(inst, "qr-code/image");
      let image =
        (typeof qr.value === "string" && qr.value) ||
        (typeof qr.qrcode === "string" && qr.qrcode) ||
        (typeof qr.base64 === "string" && qr.base64) ||
        null;
      if (
        image &&
        !image.startsWith("data:") &&
        !image.startsWith("http://") &&
        !image.startsWith("https://")
      ) {
        image = `data:image/png;base64,${image.replace(/^data:image\/\w+;base64,/, "")}`;
      }

      return json({
        ok: true,
        provisioned: true,
        status: "connecting",
        qr_image: image,
        challenge: qr.challenge ?? null,
      });
    }

    if (action === "disconnect") {
      try {
        await zapiGet(inst, "disconnect");
      } catch {
        // alguns planos usam POST; tenta fallback
        const { baseUrl, clientToken } = zapiBase(inst);
        if (inst.instance_id && inst.token) {
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (clientToken) headers["Client-Token"] = clientToken;
          await fetch(`${baseUrl}/instances/${inst.instance_id}/token/${inst.token}/disconnect`, {
            method: "POST",
            headers,
          });
        }
      }

      await admin
        .from("whatsapp_instances")
        .update({ status: "disconnected", phone: null })
        .eq("id", inst.id);

      await admin.from("automation_logs").insert({
        cliente_id: clienteId,
        action: "whatsapp_disconnected",
        metadata: { instance_row_id: inst.id },
      });

      return json({ ok: true, status: "disconnected" });
    }

    return json({ ok: false, error: "unknown_action" }, 400);
  } catch (error) {
    console.error("whatsapp-connect error", error);
    await admin.from("webhook_errors").insert({
      source: "whatsapp_connect",
      cliente_id: clienteId,
      payload: body,
      error: error instanceof Error ? error.message : String(error),
    });
    return json(
      { ok: false, error: error instanceof Error ? error.message : "whatsapp_connect_failed" },
      500,
    );
  }
});
