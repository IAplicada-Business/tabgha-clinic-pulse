import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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

  const roles = (roleRows ?? [])
    .map((r) => r.role as string)
    .filter(isAppRole);

  // Ordem estável: Super Admin primeiro, demais staff, cliente por último
  roles.sort((a, b) => {
    if (a === b) return 0;
    if (a === "admin") return -1;
    if (b === "admin") return 1;
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
      setProfile(null);
      setRoles([]);
      setActiveAreaState(null);
      setLoading(false);
      return;
    }
    const { profile: p, roles: nextRoles } = await loadProfileAndRoles(u.id);
    setProfile(p);
    setRoles(nextRoles);
    setActiveAreaState((prev) => pickViewArea(nextRoles, prev ?? readStoredActiveRole()));
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) hydrate(data.user);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      hydrate(session?.user ?? null);
    });

    const onFocus = () => {
      void supabase.auth.getUser().then(({ data }) => {
        if (mounted && data.user) void hydrate(data.user);
      });
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onFocus();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
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
    signOut: async () => {
      storeActiveRole(null);
      await supabase.auth.signOut();
    },
    refresh: async () => {
      const { data } = await supabase.auth.getUser();
      await hydrate(data.user);
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
