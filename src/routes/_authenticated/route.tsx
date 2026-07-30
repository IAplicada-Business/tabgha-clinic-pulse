import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AuthProvider, useAuth } from "@/lib/auth";
import { resolveAuthAccess, type AuthAccess } from "@/lib/auth-access";
import { AppLayout } from "@/components/AppLayout";

export type AuthenticatedContext = {
  access: AuthAccess;
};

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async (): Promise<AuthenticatedContext> => {
    const access = await resolveAuthAccess();
    if (!access) {
      throw redirect({ to: "/login" });
    }
    return { access };
  },
  component: ProtectedShell,
});

function ProtectedShell() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}

function Shell() {
  const { loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Carregando…
      </div>
    );
  }
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
