/**
 * Cache de acesso para guards de rota.
 *
 * Antes: cada navegação fazia getUser() (Auth API) + user_roles + profiles.
 * Isso somava ~1–5s por clique de menu.
 *
 * Agora: sessão local + cache em memória (TTL). RLS no banco continua
 * protegendo os dados; o guard só decide redirecionamento de UI.
 */
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isAppRole, type AppRole } from "@/lib/roles";

export type AuthAccess = {
  userId: string;
  user: User;
  roles: AppRole[];
  permissoes: string[];
  clienteId: string | null;
};

const CACHE_TTL_MS = 120_000;

let cache: { access: AuthAccess; fetchedAt: number } | null = null;
let inflight: Promise<AuthAccess | null> | null = null;

export function clearAuthAccessCache() {
  cache = null;
  inflight = null;
}

export function peekAuthAccessCache(): AuthAccess | null {
  if (!cache) return null;
  if (Date.now() - cache.fetchedAt > CACHE_TTL_MS) return null;
  return cache.access;
}

function writeCache(access: AuthAccess) {
  cache = { access, fetchedAt: Date.now() };
}

async function fetchAccess(user: User): Promise<AuthAccess> {
  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", user.id),
    supabase.from("profiles").select("permissoes, cliente_id").eq("id", user.id).maybeSingle(),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as string).filter(isAppRole) as AppRole[];

  const access: AuthAccess = {
    userId: user.id,
    user,
    roles,
    permissoes: profile?.permissoes ?? [],
    clienteId: profile?.cliente_id ?? null,
  };
  writeCache(access);
  return access;
}

/**
 * Resolve acesso do usuário autenticado.
 * Preferência: cache fresco → sessão local → fetch roles/perfil.
 */
export async function resolveAuthAccess(opts?: { force?: boolean }): Promise<AuthAccess | null> {
  if (!opts?.force) {
    const hit = peekAuthAccessCache();
    if (hit) return hit;
  }

  if (inflight && !opts?.force) return inflight;

  inflight = (async () => {
    // getSession() lê storage local — sem roundtrip ao Auth API.
    // getUser() validava no servidor e era a maior fonte de latência.
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      clearAuthAccessCache();
      return null;
    }

    const user = sessionData.session?.user ?? null;
    if (!user) {
      clearAuthAccessCache();
      return null;
    }

    if (!opts?.force) {
      const hit = peekAuthAccessCache();
      if (hit && hit.userId === user.id) return hit;
    }

    try {
      return await fetchAccess(user);
    } catch {
      clearAuthAccessCache();
      return null;
    }
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/** Atualiza o cache a partir do AuthProvider (evita refetch após hydrate). */
export function seedAuthAccessCache(input: {
  user: User;
  roles: AppRole[];
  permissoes: string[];
  clienteId: string | null;
}) {
  writeCache({
    userId: input.user.id,
    user: input.user,
    roles: input.roles,
    permissoes: input.permissoes,
    clienteId: input.clienteId,
  });
}
