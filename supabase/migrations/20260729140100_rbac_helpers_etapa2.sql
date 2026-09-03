-- Etapa 2 / Fase A — Helpers de RBAC (após commit dos novos valores de app_role).
-- Não altera policies RLS existentes de tabelas de negócio.

-- Qualquer papel interno (não-cliente) — equipe Tabgha.
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role <> 'cliente'::public.app_role
  );
$$;

-- Atalho: caller autenticado é staff?
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_staff(auth.uid());
$$;

-- Verifica se o usuário tem ao menos um dos papéis informados.
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY (_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;

COMMENT ON FUNCTION public.is_staff(uuid) IS
  'Etapa 2 Fase A: true se o usuário tem qualquer perfil interno (não cliente).';
COMMENT ON FUNCTION public.has_any_role(uuid, public.app_role[]) IS
  'Etapa 2 Fase A: true se o usuário possui ao menos um dos papéis em _roles. Usado por RLS de frentes futuras (ex.: pipeline B2B).';
