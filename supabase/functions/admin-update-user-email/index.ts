// Admin: altera o e-mail de login (Auth + profiles).
// Opcionalmente atualiza clientes.email se o perfil for portal vinculado.
// POST { user_id, email, sync_cliente_email?: boolean }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ ok: false, error: "unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY || SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ ok: false, error: "unauthorized" }, 401);

    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userData.user.id,
      _role: "super_admin",
    });
    if (roleErr || !isAdmin) return json({ ok: false, error: "apenas super admin" }, 403);

    const body = (await req.json()) as {
      user_id?: string;
      email?: string;
      sync_cliente_email?: boolean;
    };

    const userId = body.user_id?.trim();
    const email = body.email?.trim().toLowerCase();
    if (!userId || !email) {
      return json({ ok: false, error: "user_id e email são obrigatórios" }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, error: "Email inválido" }, 400);
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, email, cliente_id")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) return json({ ok: false, error: profileErr.message }, 400);
    if (!profile) return json({ ok: false, error: "Usuário não encontrado" }, 404);

    const oldEmail = (profile.email ?? "").toLowerCase();
    if (oldEmail === email) {
      return json({ ok: true, user_id: userId, email, unchanged: true });
    }

    // Conflito em profiles
    const { data: takenProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .neq("id", userId)
      .maybeSingle();
    if (takenProfile?.id) {
      return json(
        {
          ok: false,
          error: "Este email já está em uso por outro membro. Escolha outro ou edite o outro usuário primeiro.",
        },
        409,
      );
    }

    const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
      email,
      email_confirm: true,
    });
    if (authErr) {
      const msg = authErr.message || "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("exists")) {
        return json(
          {
            ok: false,
            error: "Este email já existe no Auth. Use outro ou remova o usuário antigo.",
          },
          409,
        );
      }
      return json({ ok: false, error: msg }, 400);
    }

    const { error: updProfileErr } = await admin
      .from("profiles")
      .update({ email })
      .eq("id", userId);
    if (updProfileErr) return json({ ok: false, error: updProfileErr.message }, 400);

    let clienteSynced = false;
    if (body.sync_cliente_email !== false && profile.cliente_id) {
      const { data: cliente } = await admin
        .from("clientes")
        .select("id, email")
        .eq("id", profile.cliente_id)
        .maybeSingle();
      const clienteEmail = (cliente?.email ?? "").toLowerCase();
      // Só sincroniza se o consultório ainda tinha o e-mail antigo (evita sobrescrever outro contato)
      if (cliente && (!clienteEmail || clienteEmail === oldEmail)) {
        const { error: cErr } = await admin
          .from("clientes")
          .update({ email })
          .eq("id", profile.cliente_id);
        if (!cErr) clienteSynced = true;
      }
    }

    return json({
      ok: true,
      user_id: userId,
      email,
      previous_email: oldEmail || null,
      cliente_synced: clienteSynced,
      message: "Email de login atualizado. O usuário passa a entrar com o novo email.",
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
