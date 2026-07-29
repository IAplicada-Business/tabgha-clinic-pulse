import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isAppRole, isStaff, isSuperAdmin, type AppRole } from "@/lib/roles";
import {
  canAccessPath,
  firstAllowedAdminPath,
  firstAllowedClientePath,
} from "@/lib/route-permissions";

/**
 * Guard de rota do portal do médico.
 * Super Admin em simulação passa (session flag); demais precisam do papel cliente + permissão.
 */
export const Route = createFileRoute("/_authenticated/cliente")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }

    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      supabase
        .from("profiles")
        .select("permissoes, cliente_id")
        .eq("id", data.user.id)
        .maybeSingle(),
    ]);

    const roles = (roleRows ?? [])
      .map((r) => r.role as string)
      .filter(isAppRole) as AppRole[];

    const hasCliente = roles.includes("cliente");
    const staff = isStaff(roles);

    // Simulação: Super Admin pode abrir portal sem papel cliente
    let simulating = false;
    try {
      simulating =
        typeof window !== "undefined" &&
        isSuperAdmin(roles) &&
        sessionStorage.getItem("tabgha_active_role") === "cliente";
    } catch {
      /* ignore */
    }

    if (!hasCliente && !(simulating && isSuperAdmin(roles))) {
      if (staff) {
        throw redirect({
          to: firstAllowedAdminPath(profile?.permissoes ?? null) as "/admin/dashboard",
        });
      }
      throw redirect({ to: "/login" });
    }

    const pathname = location.pathname;
    // Em simulação, Super Admin com * ou admin.* vê tudo do portal
    if (simulating && isSuperAdmin(roles)) {
      return;
    }

    if (!canAccessPath(pathname, profile?.permissoes ?? null)) {
      const fallback = firstAllowedClientePath(profile?.permissoes ?? null);
      if (fallback === pathname || fallback === "/login") {
        throw redirect({ to: "/login" });
      }
      throw redirect({ to: fallback as "/cliente/dashboard" });
    }
  },
  component: () => <Outlet />,
});
