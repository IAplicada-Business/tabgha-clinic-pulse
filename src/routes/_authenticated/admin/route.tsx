import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isStaff, isAppRole, type AppRole } from "@/lib/roles";
import {
  canAccessPath,
  firstAllowedAdminPath,
  firstAllowedClientePath,
} from "@/lib/route-permissions";

/**
 * Guard de rota do painel interno (equipe).
 * Bloqueia URL direta sem a permissão correspondente — corrige gap só-visual do menu.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/login" });
    }

    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      supabase.from("profiles").select("permissoes").eq("id", data.user.id).maybeSingle(),
    ]);

    const roles = (roleRows ?? [])
      .map((r) => r.role as string)
      .filter(isAppRole) as AppRole[];

    if (!isStaff(roles)) {
      throw redirect({
        to: firstAllowedClientePath(profile?.permissoes ?? null) as "/cliente/dashboard",
      });
    }

    const pathname = location.pathname;
    if (!canAccessPath(pathname, profile?.permissoes ?? null)) {
      const fallback = firstAllowedAdminPath(profile?.permissoes ?? null);
      if (fallback === pathname || fallback === "/login") {
        throw redirect({ to: "/login" });
      }
      throw redirect({ to: fallback as "/admin/dashboard" });
    }
  },
  component: () => <Outlet />,
});
