import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { isStaff } from "@/lib/roles";

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
  head: () => ({ meta: [{ title: "Login — Tabgha" }] }),
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
    if (error) { setError("Email ou senha incorretos."); return; }
    const userId = data.user?.id;
    if (!userId) { setError("Sessão não criada."); return; }
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles").select("role").eq("user_id", userId);
    if (rolesError) { setError("Login realizado, mas não foi possível carregar seu perfil."); return; }

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
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center px-4"
      style={{ backgroundColor: "#0B1B3E" }}
    >
      {/* Decorative gradient orbs */}
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-[480px] w-[480px] rounded-full opacity-25 blur-[100px]"
        style={{ background: "radial-gradient(circle, #1A5FAD 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full opacity-20 blur-[100px]"
        style={{ background: "radial-gradient(circle, #F6A623 0%, transparent 70%)" }}
      />
      {/* Subtle grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Glass card */}
      <div
        className="relative z-10 w-full max-w-[380px] rounded-2xl p-8"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.40), 0 0 0 1px rgba(255,255,255,0.05) inset",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-7">
          <img
            src="https://tabghamkt.com.br/wp-content/uploads/2025/05/logo_tabgha_health_mkt_caixa_alta-04-scaled-e1747895382243.png"
            alt="Tabgha Health Marketing"
            className="h-8 w-auto mb-5 brightness-0 invert"
          />
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-white/30">
            Plataforma de Gestão
          </p>
        </div>

        {/* Access type switcher */}
        <div
          className="mb-6 grid grid-cols-2 rounded-xl p-1 gap-1"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {(["equipe", "cliente"] as AccessType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setAccess(t); setError(null); }}
              className="rounded-lg px-3 py-2 text-[12px] font-semibold transition-all duration-200"
              style={
                access === t
                  ? { background: "#1A5FAD", color: "#ffffff", boxShadow: "0 2px 8px rgba(30,92,200,0.40)" }
                  : { color: "rgba(255,255,255,0.45)" }
              }
            >
              {t === "equipe" ? "Equipe Tabgha" : "Portal do Cliente"}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
            onFocus={(e) => (e.currentTarget.style.border = "1px solid rgba(30,92,200,0.70)")}
            onBlur={(e) => (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)")}
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-all"
            style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
            onFocus={(e) => (e.currentTarget.style.border = "1px solid rgba(30,92,200,0.70)")}
            onBlur={(e) => (e.currentTarget.style.border = "1px solid rgba(255,255,255,0.10)")}
          />

          {error && (
            <p className="rounded-lg px-3 py-2 text-xs text-red-300" style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.20)" }}>
              {error}
            </p>
          )}

          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #1A5FAD 0%, #1749A0 100%)", boxShadow: "0 4px 14px rgba(30,92,200,0.35)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </div>
        </form>

        {/* Footer link */}
        <p className="mt-6 text-center text-[11px] text-white/25">
          Problemas com o acesso?{" "}
          <a href="mailto:contato@tabghamkt.com.br" className="text-white/50 underline underline-offset-2 hover:text-white/70 transition-colors">
            Fale com a equipe
          </a>
        </p>
      </div>

      {/* Bottom badge */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
        <p className="text-[10px] text-white/20 tracking-wider">
          TABGHA HEALTH MARKETING © 2025
        </p>
      </div>
    </div>
  );
}
