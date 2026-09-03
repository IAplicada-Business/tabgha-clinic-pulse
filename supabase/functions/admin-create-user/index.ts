// Cria/atualiza usuário Auth + profile/roles (admin only).
// Senha provisória padrão: Tabgha{ano} (ex.: Tabgha2026).
//
// POST {
//   action?: "create" | "reset_password",
//   email?, nome?,
//   role?: AppRole,                       // legado (um papel)
//   roles?: AppRole[],                    // preferido (staff + opcional cliente)
//   cliente_id?, permissoes?,
//   user_id?                              // obrigatório em reset_password
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const APP_ROLES = [
  "super_admin",
  "gestor_estrategico",
  "growth_manager",
  "social_media",
  "performance",
  "atendimento_cs",
  "financeiro",
  "cliente",
] as const;

type AppRole = (typeof APP_ROLES)[number];

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

function provisionalPassword(now = new Date()) {
  return `Tabgha${now.getFullYear()}`;
}

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

function normalizeRoles(body: {
  role?: string;
  roles?: string[];
}): AppRole[] {
  const fromArray = (body.roles ?? []).filter(isAppRole);
  if (fromArray.length > 0) return [...new Set(fromArray)];
  if (body.role && isAppRole(body.role)) return [body.role];
  return [];
}

async function findExistingByEmail(email: string): Promise<{
  userId: string;
  roles: AppRole[];
} | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profile?.id) {
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id);
    return {
      userId: profile.id,
      roles: (roleRows ?? []).map((r) => r.role as AppRole).filter(isAppRole),
    };
  }

  const { data: listed, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const found = listed.users.find((u) => (u.email ?? "").toLowerCase() === email);
  if (!found) return null;
  const { data: roleRows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", found.id);
  return {
    userId: found.id,
    roles: (roleRows ?? []).map((r) => r.role as AppRole).filter(isAppRole),
  };
}

async function syncRoles(userId: string, roles: AppRole[]) {
  const { data: currentRows } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const current = new Set((currentRows ?? []).map((r) => r.role as AppRole));
  const wanted = new Set(roles);

  for (const role of wanted) {
    if (!current.has(role)) {
      const { error } = await admin.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    }
  }
  for (const role of current) {
    if (!wanted.has(role)) {
      const { error } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
    }
  }
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

  return { ok: true as const, userId: userData.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const caller = await assertCallerIsAdmin(authHeader);
    if (!caller.ok) return caller.response;

    const body = (await req.json()) as {
      action?: "create" | "reset_password";
      email?: string;
      nome?: string;
      role?: AppRole;
      roles?: AppRole[];
      cliente_id?: string | null;
      permissoes?: string[];
      user_id?: string;
    };

    const action = body.action ?? "create";
    const temporaryPassword = provisionalPassword();

    // ── Reset de senha provisória (reexibe credenciais) ──────────────────────
    if (action === "reset_password") {
      const userId = body.user_id?.trim();
      if (!userId) return json({ ok: false, error: "user_id obrigatório" }, 400);

      const { data: profile, error: profileErr } = await admin
        .from("profiles")
        .select("id, email, nome")
        .eq("id", userId)
        .maybeSingle();
      if (profileErr) return json({ ok: false, error: profileErr.message }, 400);
      if (!profile) return json({ ok: false, error: "Usuário não encontrado." }, 404);

      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password: temporaryPassword,
        email_confirm: true,
      });
      if (updateErr) return json({ ok: false, error: updateErr.message }, 400);

      const { data: roleRows } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      return json({
        ok: true,
        user_id: userId,
        email: profile.email,
        temporary_password: temporaryPassword,
        reused_existing: true,
        roles: (roleRows ?? []).map((r) => r.role),
        message: "Senha provisória redefinida para Tabgha{ano}.",
      });
    }

    // ── Create / upsert acesso ───────────────────────────────────────────────
    const email = body.email?.trim().toLowerCase();
    const nome = body.nome?.trim();
    const roles = normalizeRoles(body);
    if (!email || !nome || roles.length === 0) {
      return json(
        { ok: false, error: "email, nome e ao menos um perfil são obrigatórios" },
        400,
      );
    }

    const staffRoles = roles.filter((r) => r !== "cliente");
    if (staffRoles.length > 1) {
      return json(
        { ok: false, error: "Selecione apenas um perfil interno da equipe." },
        400,
      );
    }

    const wantsCliente = roles.includes("cliente");
    if (wantsCliente && !body.cliente_id) {
      return json({ ok: false, error: "cliente_id obrigatório quando o portal do médico está liberado" }, 400);
    }

    let userId: string | null = null;
    let reusedExisting = false;

    const existing = await findExistingByEmail(email);
    if (existing) {
      userId = existing.userId;
      reusedExisting = true;
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password: temporaryPassword,
        email_confirm: true,
      });
      if (updateErr) return json({ ok: false, error: updateErr.message }, 400);
    } else {
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        password: temporaryPassword,
      });
      if (authError) {
        const msg = authError.message || "";
        const exists =
          msg.toLowerCase().includes("already been registered") ||
          msg.toLowerCase().includes("email_exists");
        if (exists) {
          const again = await findExistingByEmail(email);
          if (again) {
            userId = again.userId;
            reusedExisting = true;
            const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
              password: temporaryPassword,
              email_confirm: true,
            });
            if (updateErr) return json({ ok: false, error: updateErr.message }, 400);
          } else {
            return json(
              {
                ok: false,
                error:
                  "Este email já existe no Auth. Edite o usuário na lista ou tente de novo em alguns segundos.",
              },
              409,
            );
          }
        } else {
          return json({ ok: false, error: msg }, 400);
        }
      } else {
        userId = authData.user.id;
      }
    }

    if (!userId) return json({ ok: false, error: "Não foi possível obter o usuário." }, 500);

    const clienteId = wantsCliente ? body.cliente_id ?? null : null;

    // Garante profile + ao menos o primeiro papel via RPC; depois sincroniza o conjunto.
    const primaryRole: AppRole =
      staffRoles[0] ?? (wantsCliente ? "cliente" : "super_admin");

    // Sem permissões explícitas, o preset vem da matriz roles_permissoes.
    // (Antes o default era ["*"], o que dava acesso total a qualquer perfil.)
    const { error: rpcError } = await admin.rpc("admin_upsert_profile_role", {
      _user_id: userId,
      _role: primaryRole,
      _cliente_id: clienteId ?? undefined,
      _permissoes: body.permissoes ?? undefined,
    });
    if (rpcError) return json({ ok: false, error: rpcError.message }, 400);

    await syncRoles(userId, roles);

    const perfilUpdate: Record<string, unknown> = { nome, email, cliente_id: clienteId };
    if (body.permissoes) perfilUpdate.permissoes = body.permissoes;

    const { error: profileErr } = await admin
      .from("profiles")
      .update(perfilUpdate)
      .eq("id", userId);
    if (profileErr) return json({ ok: false, error: profileErr.message }, 400);

    const { data: perfilFinal } = await admin
      .from("profiles")
      .select("permissoes")
      .eq("id", userId)
      .maybeSingle();

    return json({
      ok: true,
      user_id: userId,
      reused_existing: reusedExisting,
      temporary_password: temporaryPassword,
      email,
      role: primaryRole,
      roles,
      permissoes: perfilFinal?.permissoes ?? [],
      message: reusedExisting
        ? "Usuário já existia — senha provisória redefinida para Tabgha{ano}."
        : "Usuário criado. Senha provisória: Tabgha{ano}.",
    });
  } catch (error) {
    return json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      500,
    );
  }
});
