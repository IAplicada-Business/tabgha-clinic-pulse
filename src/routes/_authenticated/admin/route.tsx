import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resolveAuthAccess } from "@/lib/auth-access";
import { isStaff } from "@/lib/roles";
import {
  canAccessPath,
  firstAllowedAdminPath,
  firstAllowedClientePath,
} from "@/lib/route-permissions";

/**
 * Guard de rota do painel interno (equipe).
 * Usa cache de acesso — não refaz Auth API a cada clique de menu.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    const access =
      (context as { access?: Awaited<ReturnType<typeof resolveAuthAccess>> }).access ??
      (await resolveAuthAccess());

    if (!access) {
      throw redirect({ to: "/login" });
    }

    if (!isStaff(access.roles)) {
      throw redirect({
        to: firstAllowedClientePath(access.permissoes) as "/cliente/dashboard",
      });
    }

    const pathname = location.pathname;
    if (!canAccessPath(pathname, access.permissoes)) {
      const fallback = firstAllowedAdminPath(access.permissoes);
      if (fallback === pathname || fallback === "/login") {
        throw redirect({ to: "/login" });
      }
      throw redirect({ to: fallback as "/admin/dashboard" });
    }
  },
  component: () => <Outlet />,
});
