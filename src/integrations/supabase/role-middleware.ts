import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

export type AuthContext = {
  userId: string;
  email: string | undefined;
  role: Database["public"]["Enums"]["app_role"];
  clienteId: string | null;
  permissoes: string[] | null;
  accessToken: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
};

export const requireRoleAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Missing Supabase env vars");
    }

    const request = getRequest();
    const authHeader = request?.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    if (!token) throw new Response("Unauthorized", { status: 401 });

    const authClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const {
      data: { user },
      error,
    } = await authClient.auth.getUser(token);
    if (error || !user) throw new Response("Unauthorized", { status: 401 });

    const { supabaseAdmin: admin } = await import("./client.server");

    const [profileResult, roleResult] = await Promise.all([
      admin.from("profiles").select("cliente_id, permissoes").eq("id", user.id).maybeSingle(),
      admin.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    const roles = (roleResult.data ?? []).map((r) => r.role);
    // Prefer Super Admin, depois qualquer staff, depois cliente
    const primaryRole =
      roles.find((r) => r === "admin") ??
      roles.find((r) => r !== "cliente") ??
      roles[0] ??
      null;

    if (profileResult.error || roleResult.error || !primaryRole) {
      throw new Response("Forbidden", { status: 403 });
    }

    const auth: AuthContext = {
      userId: user.id,
      email: user.email,
      role: primaryRole,
      clienteId: profileResult.data?.cliente_id ?? null,
      permissoes: profileResult.data?.permissoes ?? null,
      accessToken: token,
      supabase: admin,
    };

    return next({ context: { auth } });
  },
);

export function assertClienteAccess(auth: AuthContext, clienteId: string) {
  // Super Admin e demais perfis internos (staff) passam; portal só o próprio cliente.
  if (auth.role !== "cliente") return;
  if (auth.clienteId !== clienteId) {
    throw new Response("Forbidden", { status: 403 });
  }
}
