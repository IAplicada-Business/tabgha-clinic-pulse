import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TabghaLogo } from "@/components/TabghaLogo";
import { signOutTabgha } from "@/lib/auth";
import { resolveAuthAccess } from "@/lib/auth-access";
import { isStaff } from "@/lib/roles";
import { firstAllowedAdminPath, firstAllowedClientePath } from "@/lib/route-permissions";

/**
 * Destino do middleware de rota quando o perfil não tem a permissão exigida.
 * A rota tentada chega em ?de= só para dar contexto na tela.
 *
 * Esta rota mora fora de /_authenticated, então NÃO existe AuthProvider acima
 * dela — usar useAuth() aqui derruba a tela inteira. O perfil vem do mesmo
 * cache que os guards já usam (resolveAuthAccess), sem segunda fonte de dados.
 */
export const Route = createFileRoute("/acesso-negado")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    de: typeof search.de === "string" ? search.de : "",
  }),
  loader: async () => {
    const access = await resolveAuthAccess();
    return {
      permissoes: access?.permissoes ?? [],
      staff: isStaff(access?.roles),
    };
  },
  component: AcessoNegadoPage,
  head: () => ({ meta: [{ title: "Acesso negado · Tabgha OS" }] }),
});

function AcessoNegadoPage() {
  const { de } = Route.useSearch();
  const { permissoes, staff } = Route.useLoaderData();
  const navigate = useNavigate();

  const destino = staff ? firstAllowedAdminPath(permissoes) : firstAllowedClientePath(permissoes);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-card)]">
        <TabghaLogo altura={26} className="mx-auto" />

        <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
        </div>

        <h1 className="mt-4 text-lg font-extrabold tracking-tight">Acesso negado</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Você não tem permissão para acessar esta área. Fale com o administrador.
        </p>
        {de ? (
          <p className="mt-3 rounded-lg bg-secondary/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {de}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col gap-2">
          {destino === "/login" ? null : (
            <Button asChild>
              <Link to={destino as "/admin/dashboard"}>Ir para uma área liberada</Link>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              await signOutTabgha();
              void navigate({ to: "/login", replace: true });
            }}
          >
            Entrar com outra conta
          </Button>
        </div>
      </div>
    </div>
  );
}
