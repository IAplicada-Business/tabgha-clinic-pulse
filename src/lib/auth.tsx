import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearAuthAccessCache, seedAuthAccessCache } from "@/lib/auth-access";
import {
  type AppRole,
  type ViewArea,
  isAppRole,
  isStaff,
  isSuperAdmin,
  primaryStaffRole,
} from "@/lib/roles";

export type { AppRole, ViewArea };

const ACTIVE_ROLE_KEY = "tabgha_active_role";

export interface Profile {
  id: string;
  cliente_id: string | null;
  nome: string | null;
  email: string | null;
  permissoes: string[];
}

interface AuthState {
  loading: boolean;
  user: User | null;
  profile: Profile | null;
  /** Área ativa na UI (painel interno vs portal). */
  role: ViewArea | null;
  /** Papel “principal” (staff preferido; senão cliente). */
  realRole: AppRole | null;
  /** Todos os papéis do usuário. */
  roles: AppRole[];
  setActiveRole: (area: ViewArea) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  isSimulating: boolean;
  simulatedClientId: string | null;
  simulatedClientNome: string | null;
  startSimulation: (id: string, nome: string) => void;
  stopSimulation: () => void;
}

const AuthCtx = createContext<AuthState | undefined>(undefined);

function readStoredActiveRole(): ViewArea | null {
  if (typeof window === "undefined") return null;
  try {
    const v = sessionStorage.getItem(ACTIVE_ROLE_KEY);
    if (v === "admin" || v === "cliente") return v;
  } catch {
    /* ignore */
  }
  return null;
}

function storeActiveRole(area: ViewArea | null) {
  if (typeof window === "undefined") return;
  try {
    if (area) sessionStorage.setItem(ACTIVE_ROLE_KEY, area);
    else sessionStorage.removeItem(ACTIVE_ROLE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Encerra a sessão. Fora do AuthProvider (ex.: /acesso-negado) esta é a única
 * porta de saída — o `signOut` do contexto delega aqui para não existirem dois
 * caminhos de logout.
 */
export async function signOutTabgha() {
  storeActiveRole(null);
  clearAuthAccessCache();
  await supabase.auth.signOut();
}

async function loadProfileAndRoles(
  userId: string,
): Promise<{ profile: Profile | null; roles: AppRole[] }> {
  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, cliente_id, nome, email, permissoes")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as string).filter(isAppRole);

  // Ordem estável: Super Admin primeiro, demais staff, cliente por último
  roles.sort((a, b) => {
    if (a === b) return 0;
    if (a === "super_admin") return -1;
    if (b === "super_admin") return 1;
    if (a === "cliente") return 1;
    if (b === "cliente") return -1;
    return a.localeCompare(b);
  });

  return {
    profile: profile
      ? {
          id: profile.id,
          cliente_id: profile.cliente_id,
          nome: profile.nome,
          email: profile.email,
          permissoes: profile.permissoes ?? [],
        }
      : null,
    roles,
  };
}

function pickViewArea(roles: AppRole[], preferred: ViewArea | null): ViewArea | null {
  const staff = isStaff(roles);
  const hasCliente = roles.includes("cliente");
  if (preferred === "admin" && staff) return "admin";
  if (preferred === "cliente" && hasCliente) return "cliente";
  if (staff) return "admin";
  if (hasCliente) return "cliente";
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [activeArea, setActiveAreaState] = useState<ViewArea | null>(null);
  const [simulatedClientId, setSimulatedClientId] = useState<string | null>(null);
  const [simulatedClientNome, setSimulatedClientNome] = useState<string | null>(null);

  const hydrate = async (u: User | null) => {
    setUser(u);
    if (!u) {
      clearAuthAccessCache();
      setProfile(null);
      setRoles([]);
      setActiveAreaState(null);
      setLoading(false);
      return;
    }
    const { profile: p, roles: nextRoles } = await loadProfileAndRoles(u.id);
    setProfile(p);
    setRoles(nextRoles);
    seedAuthAccessCache({
      user: u,
      roles: nextRoles,
      permissoes: p?.permissoes ?? [],
      clienteId: p?.cliente_id ?? null,
    });
    setActiveAreaState((prev) => pickViewArea(nextRoles, prev ?? readStoredActiveRole()));
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    // Sessão local primeiro — evita Auth API no boot.
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) void hydrate(data.session?.user ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        clearAuthAccessCache();
      }
      if (
        event !== "SIGNED_IN" &&
        event !== "SIGNED_OUT" &&
        event !== "USER_UPDATED" &&
        event !== "TOKEN_REFRESHED"
      ) {
        return;
      }
      if (event === "TOKEN_REFRESHED" && session?.user) {
        // Só atualiza referência do user; roles já estão em cache.
        setUser(session.user);
        return;
      }
      void hydrate(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const realRole: AppRole | null =
    primaryStaffRole(roles) ?? (roles.includes("cliente") ? "cliente" : null);

  const viewArea = pickViewArea(roles, activeArea);
  const isSimulating = !!simulatedClientId && isSuperAdmin(roles);

  const value: AuthState = {
    loading,
    user,
    profile: isSimulating && profile ? { ...profile, cliente_id: simulatedClientId } : profile,
    role: isSimulating ? "cliente" : viewArea,
    realRole,
    roles,
    setActiveRole: (area) => {
      const staff = isStaff(roles);
      const hasCliente = roles.includes("cliente");
      if (area === "admin" && !staff) return;
      if (area === "cliente" && !hasCliente) return;
      storeActiveRole(area);
      setActiveAreaState(area);
      setSimulatedClientId(null);
      setSimulatedClientNome(null);
    },
    signOut: signOutTabgha,
    refresh: async () => {
      clearAuthAccessCache();
      const { data } = await supabase.auth.getSession();
      await hydrate(data.session?.user ?? null);
    },
    isSimulating,
    simulatedClientId,
    simulatedClientNome,
    startSimulation: (id, nome) => {
      if (!isSuperAdmin(roles)) return;
      setSimulatedClientId(id);
      setSimulatedClientNome(nome);
      storeActiveRole("cliente");
      setActiveAreaState("cliente");
    },
    stopSimulation: () => {
      setSimulatedClientId(null);
      setSimulatedClientNome(null);
      storeActiveRole("admin");
      setActiveAreaState("admin");
    },
  };

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth fora do AuthProvider");
  return ctx;
}
