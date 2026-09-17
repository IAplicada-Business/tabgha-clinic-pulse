import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { resolveAuthAccess } from "@/lib/auth-access";
import { isStaff, isSuperAdmin } from "@/lib/roles";
import { canAccessPath, firstAllowedAdminPath } from "@/lib/route-permissions";

/**
 * Guard de rota do portal do médico.
 * Usa cache de acesso — não refaz Auth API a cada clique de menu.
 */
export const Route = createFileRoute("/_authenticated/cliente")({
  ssr: false,
  beforeLoad: async ({ location, context }) => {
    const access =
      (context as { access?: Awaited<ReturnType<typeof resolveAuthAccess>> }).access ??
      (await resolveAuthAccess());

    if (!access) {
      throw redirect({ to: "/login" });
    }

    const hasCliente = access.roles.includes("cliente");
    const staff = isStaff(access.roles);

    let simulating = false;
    try {
      simulating =
        typeof window !== "undefined" &&
        isSuperAdmin(access.roles) &&
        sessionStorage.getItem("tabgha_active_role") === "cliente";
    } catch {
      /* ignore */
    }

    if (!hasCliente && !(simulating && isSuperAdmin(access.roles))) {
      if (staff) {
        throw redirect({
          to: firstAllowedAdminPath(access.permissoes) as "/admin/dashboard",
        });
      }
      throw redirect({ to: "/login" });
    }

    if (simulating && isSuperAdmin(access.roles)) {
      return;
    }

    // Rota fora da matriz do perfil → /acesso-negado (o middleware do item 8).
    const pathname = location.pathname;
    if (!canAccessPath(pathname, access.permissoes)) {
      throw redirect({ to: "/acesso-negado", search: { de: pathname } });
    }
  },
  component: () => <Outlet />,
});
