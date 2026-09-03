import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { isStaff } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabghaLogo } from "@/components/TabghaLogo";

type AccessType = "equipe" | "cliente";
const ACTIVE_ROLE_KEY = "tabgha_active_role";

function preferDestination(
  roles: Array<{ role: string }>,
  access: AccessType,
): "/admin/dashboard" | "/cliente/dashboard" {
  const roleNames = roles.map((r) => r.role);
  const hasStaff = isStaff(roleNames);
  const hasCliente = roleNames.includes("cliente");
  if (access === "equipe" && hasStaff) {
    try {
      sessionStorage.setItem(ACTIVE_ROLE_KEY, "admin");
    } catch {
      /* ignore */
    }
    return "/admin/dashboard";
  }
  if (access === "cliente" && hasCliente) {
    try {
      sessionStorage.setItem(ACTIVE_ROLE_KEY, "cliente");
    } catch {
      /* ignore */
    }
    return "/cliente/dashboard";
  }
  if (hasStaff) {
    try {
      sessionStorage.setItem(ACTIVE_ROLE_KEY, "admin");
    } catch {
      /* ignore */
    }
    return "/admin/dashboard";
  }
  try {
    sessionStorage.setItem(ACTIVE_ROLE_KEY, "cliente");
  } catch {
    /* ignore */
  }
  return "/cliente/dashboard";
}

export const Route = createFileRoute("/login")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const preferred =
        typeof window !== "undefined" ? sessionStorage.getItem(ACTIVE_ROLE_KEY) : null;
      const access: AccessType = preferred === "cliente" ? "cliente" : "equipe";
      throw redirect({ to: preferDestination(roles ?? [], access) });
    }
  },
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar · Tabgha OS" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [access, setAccess] = useState<AccessType>("cliente");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email ou senha incorretos.");
      return;
    }
    const userId = data.user?.id;
    if (!userId) {
      setError("Sessão não criada.");
      return;
    }
    // Conta desativada em /admin/usuarios não entra (o registro continua existindo).
    const { data: perfil } = await supabase
      .from("profiles")
      .select("ativo")
      .eq("id", userId)
      .maybeSingle();
    if (perfil && perfil.ativo === false) {
      await supabase.auth.signOut();
      setError("Este acesso está desativado. Fale com o administrador.");
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (rolesError) {
      setError("Login realizado, mas não foi possível carregar seu perfil.");
      return;
    }

    // profiles_self é SELECT-only; o carimbo entra pela função SECURITY DEFINER.
    void supabase.rpc("registrar_acesso");

    const roleNames = (roles ?? []).map((r) => r.role);
    const hasStaff = isStaff(roleNames);
    const hasCliente = roleNames.includes("cliente");
    if (access === "equipe" && !hasStaff) {
      setError(
        "Este login não tem acesso de equipe. Use Portal do Cliente ou peça um perfil interno (Super Admin, Growth, etc.).",
      );
      return;
    }
    if (access === "cliente" && !hasCliente) {
      setError("Este login não tem portal do médico. Use Equipe Tabgha ou peça o perfil Cliente.");
      return;
    }

    navigate({ to: preferDestination(roles ?? [], access), replace: true });
  }

  return (
    <div className="flex min-h-screen w-full flex-col md:flex-row">
      {/* ── Lado esquerdo · marca ─────────────────────────────────────────── */}
      <div
        className="relative flex shrink-0 flex-col items-center justify-center overflow-hidden px-8 py-10 md:w-1/2 md:py-0"
        style={{
          background: "linear-gradient(150deg, var(--brand-navy) 0%, var(--brand-blue) 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.35) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative z-10 flex flex-col items-center text-center">
          <TabghaLogo tone="claro" altura={72} className="md:!h-24" />
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55 sm:text-[13px]">
            Health Growth Operating System
          </p>
          <span
            className="mt-6 h-[3px] w-16 rounded-full"
            style={{ background: "var(--accent-orange)" }}
          />
          <p className="mt-6 hidden max-w-sm text-sm leading-relaxed text-white/45 md:block">
            Estratégia, IA, CRM, automação e dados na mesma operação — para clínicas que querem
            crescimento previsível.
          </p>
        </div>
      </div>

      {/* ── Lado direito · formulário ─────────────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-card px-6 py-12">
        <div className="w-full max-w-[380px]">
          <h1 className="text-xl font-extrabold tracking-tight">Entrar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse com o e-mail cadastrado na Tabgha.
          </p>

          {/* Tipo de acesso */}
          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/50 p-1">
            {(["equipe", "cliente"] as AccessType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setAccess(t);
                  setError(null);
                }}
                className={
                  access === t
                    ? "rounded-lg bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground transition-all duration-200"
                    : "rounded-lg px-3 py-2 text-[12px] font-semibold text-muted-foreground transition-all duration-200 hover:text-foreground"
                }
              >
                {t === "equipe" ? "Equipe Tabgha" : "Portal do Cliente"}
              </button>
            ))}
          </div>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="login-email">E-mail</Label>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="voce@clinica.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="login-senha">Senha</Label>
              <Input
                id="login-senha"
                type="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={loading} className="w-full gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Entrando…" : "Entrar"}
            </Button>
          </form>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            Problemas com o acesso?{" "}
            <a
              href="mailto:contato@tabghamkt.com.br"
              className="font-medium text-primary underline-offset-2 transition-colors hover:text-[var(--accent-orange)] hover:underline"
            >
              Fale com a equipe
            </a>
          </p>

          <p className="mt-10 text-center text-[10.5px] text-muted-foreground/70">
            © 2026 Tabgha · Todos os direitos reservados
          </p>
        </div>
      </div>
    </div>
  );
}
