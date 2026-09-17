import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resolveAuthAccess } from "@/lib/auth-access";
import { isStaff } from "@/lib/roles";
import { canAccessPath, firstAllowedClientePath } from "@/lib/route-permissions";

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

    // Rota fora da matriz do perfil → /acesso-negado (o middleware do item 8).
    const pathname = location.pathname;
    if (!canAccessPath(pathname, access.permissoes)) {
      throw redirect({ to: "/acesso-negado", search: { de: pathname } });
    }
  },
  component: () => <Outlet />,
});
