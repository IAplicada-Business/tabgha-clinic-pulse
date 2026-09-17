-- 8 perfis de acesso · matriz de permissões por rota
--
-- Decisões anti-duplicação:
--   * A matriz do briefing cita rotas que não existem no sistema. Em vez de
--     criar menu novo para cada uma, ela foi mapeada nas rotas reais:
--       /admin/dashboard-executivo → /admin/dashboard-clientes
--       /admin/crm, /admin/crm/funis → /admin/leads e /admin/pipeline-comercial
--       /admin/whatsapp            → /admin/atendimento
--       /admin/conteudo            → /admin/estrategia
--       /admin/calendario-editorial→ /admin/calendario
--       /admin/relatorios          → /admin/roi
--       /admin/integracoes, /admin/pixels-conversoes → /admin/config-meta
--       /portal/*                  → /cliente/*
--     /admin/google-ads e /admin/clientes/cadastrar ficam de fora: não existem
--     como tela (o cadastro de cliente é modal dentro de /admin/clientes).
--     /admin/financeiro e /admin/biblioteca-criativa entram já mapeados —
--     as telas chegam nos itens 9 e 10.
--   * Continua existindo UM mecanismo de autorização: profiles.permissoes.
--     roles_permissoes é a matriz que gera esse array, não um segundo guarda.
--   * O grupo genérico admin.operacao é dividido em admin.crm, admin.calendario
--     e admin.nutricao, porque a matriz dá acessos diferentes para cada um.

-- ── 1. admin → super_admin ──────────────────────────────────────────────────
-- RENAME VALUE mantém o OID do rótulo, então políticas RLS (que guardam a
-- expressão já analisada) continuam válidas. Corpos de função são texto e
-- precisam ser reescritos — são os 6 abaixo.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'admin'
  ) THEN
    ALTER TYPE public.app_role RENAME VALUE 'admin' TO 'super_admin';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.assert_current_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'apenas super admin' USING ERRCODE='42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.bootstrap_admin(_email text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE role='super_admin') THEN
    RAISE EXCEPTION 'super admin já existe — use admin_upsert_profile_role';
  END IF;
  SELECT id INTO uid FROM auth.users WHERE email = _email;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'usuário com email % não existe — criar pelo Auth primeiro', _email;
  END IF;
  INSERT INTO public.user_roles(user_id,role) VALUES (uid,'super_admin') ON CONFLICT DO NOTHING;
  INSERT INTO public.profiles(id,email,permissoes) VALUES (uid,_email,ARRAY['*'])
    ON CONFLICT (id) DO UPDATE SET permissoes = ARRAY['*'];
  RETURN uid;
END $$;

CREATE OR REPLACE FUNCTION public.log_ticket_converted(_lead_id uuid, _ticket numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente uuid;
  v_obs text;
  v_my_cliente uuid;
BEGIN
  SELECT cliente_id, observacoes INTO v_cliente, v_obs FROM leads WHERE id = _lead_id;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'lead não encontrado'; END IF;

  v_my_cliente := public.current_cliente_id();
  IF NOT public.has_role(auth.uid(), 'super_admin')
     AND (v_my_cliente IS NULL OR v_my_cliente <> v_cliente) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE leads SET
    status = 'convertido',
    motivo_perda = NULL,
    observacoes = CASE
      WHEN v_obs IS NULL OR btrim(v_obs) = '' THEN 'ticket: ' || _ticket::text
      WHEN v_obs ~* 'ticket:\s*[0-9]+' THEN regexp_replace(v_obs, 'ticket:\s*[0-9.]+', 'ticket: ' || _ticket::text, 'i')
      ELSE v_obs || ' | ticket: ' || _ticket::text
    END,
    atualizado_em = now()
  WHERE id = _lead_id;

  INSERT INTO automation_logs(cliente_id, action, metadata)
  VALUES (v_cliente, 'lead_converted',
    jsonb_build_object('lead_id', _lead_id, 'ticket', _ticket, 'by', auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.mover_lead_status(_lead_id uuid, _novo text, _motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cliente uuid;
  v_my_cliente uuid;
BEGIN
  IF _novo NOT IN ('novo','em_conversa','interessado','agendado','atendido','convertido','perdido') THEN
    RAISE EXCEPTION 'status inválido: %', _novo;
  END IF;
  IF _novo = 'perdido' AND (_motivo IS NULL OR _motivo = '') THEN
    RAISE EXCEPTION 'motivo_perda obrigatório ao mover para perdido';
  END IF;

  SELECT cliente_id INTO v_cliente FROM leads WHERE id = _lead_id;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'lead não encontrado'; END IF;

  v_my_cliente := public.current_cliente_id();
  IF NOT public.has_role(auth.uid(), 'super_admin')
     AND (v_my_cliente IS NULL OR v_my_cliente <> v_cliente) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE leads SET
    status = _novo,
    motivo_perda = CASE WHEN _novo = 'perdido' THEN _motivo ELSE NULL END,
    atualizado_em = now()
  WHERE id = _lead_id;

  INSERT INTO automation_logs(cliente_id, action, metadata)
  VALUES (v_cliente, 'lead_status_changed',
    jsonb_build_object('lead_id', _lead_id, 'novo', _novo, 'motivo', _motivo, 'by', auth.uid()));

  IF _novo = 'convertido' THEN
    INSERT INTO automation_logs(cliente_id, action, metadata)
    VALUES (v_cliente, 'lead_converted', jsonb_build_object('lead_id', _lead_id, 'by', auth.uid()));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mover_oportunidade_b2b_status(_id uuid, _novo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _novo NOT IN (
    'novo_lead','contato_iniciado','diagnostico_agendado','proposta_enviada',
    'negociacao','cliente_ativo','pos_venda','cliente_promotor'
  ) THEN
    RAISE EXCEPTION 'status inválido: %', _novo;
  END IF;

  IF NOT public.has_any_role(
    auth.uid(),
    ARRAY['super_admin'::public.app_role, 'gestor_estrategico'::public.app_role,
          'growth_manager'::public.app_role]
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.oportunidades_b2b SET status = _novo, atualizado_em = now() WHERE id = _id;
  IF NOT FOUND THEN RAISE EXCEPTION 'oportunidade não encontrada'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.responder_conteudo(_id uuid, _aprovada boolean, _feedback text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.current_cliente_id() IS NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  UPDATE public.conteudos
  SET
    status = CASE WHEN _aprovada THEN 'agendado' ELSE 'roteiro' END,
    feedback_cliente = CASE
      WHEN _aprovada THEN NULL
      ELSE NULLIF(trim(COALESCE(_feedback, '')), '')
    END,
    atualizado_em = now()
  WHERE id = _id
    AND status = 'aprovacao'
    AND (public.has_role(auth.uid(), 'super_admin') OR cliente_id = public.current_cliente_id());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conteúdo não encontrado ou não está aguardando aprovação';
  END IF;
END $$;

-- ── 2. Status e último acesso do usuário ────────────────────────────────────

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ultimo_acesso timestamptz;

COMMENT ON COLUMN public.profiles.ativo IS
  'false bloqueia o login sem apagar o usuário (botão Desativar em /admin/usuarios).';

-- ── 3. Matriz de permissões por rota ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.roles_permissoes (
  rota text NOT NULL,
  role public.app_role NOT NULL,
  permitido boolean NOT NULL DEFAULT true,
  /* Grupo de permissão que a rota consome (o que vai para profiles.permissoes). */
  permissao text NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rota, role)
);

COMMENT ON TABLE public.roles_permissoes IS
  'Matriz perfil × rota. É a origem única dos presets aplicados em profiles.permissoes.';

ALTER TABLE public.roles_permissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS roles_permissoes_staff_select ON public.roles_permissoes;
CREATE POLICY roles_permissoes_staff_select ON public.roles_permissoes
  FOR SELECT USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS roles_permissoes_super_admin_all ON public.roles_permissoes;
CREATE POLICY roles_permissoes_super_admin_all ON public.roles_permissoes
  FOR ALL
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

GRANT SELECT ON public.roles_permissoes TO authenticated;
GRANT ALL ON public.roles_permissoes TO service_role;

-- Matriz do briefing, já mapeada nas rotas reais.
DELETE FROM public.roles_permissoes;
INSERT INTO public.roles_permissoes (rota, role, permissao, permitido)
SELECT m.rota, r.role::public.app_role, m.permissao, r.permitido
FROM (
  VALUES
    ('/admin/dashboard',           'admin.dashboard'),
    ('/admin/dashboard-clientes',  'admin.dashboard_executivo'),
    ('/admin/clientes',            'admin.clientes'),
    ('/admin/leads',               'admin.crm'),
    ('/admin/pipeline-comercial',  'admin.pipeline'),
    ('/admin/atendimento',         'admin.atendimento'),
    ('/admin/cerebro-pietro',      'admin.cerebro'),
    ('/admin/nutricao',            'admin.nutricao'),
    ('/admin/automacoes-leads',    'admin.nutricao'),
    ('/admin/estrategia',          'admin.estrategia'),
    ('/admin/calendario',          'admin.calendario'),
    ('/admin/biblioteca-criativa', 'admin.biblioteca'),
    ('/admin/meta-ads',            'admin.meta_ads'),
    ('/admin/config-meta',         'admin.meta_ads'),
    ('/admin/diagnosticos',        'admin.diagnosticos'),
    ('/admin/financeiro',          'admin.financeiro'),
    ('/admin/roi',                 'admin.roi'),
    ('/admin/usuarios',            'admin.usuarios'),
    ('/cliente/dashboard',         'cliente.dashboard'),
    ('/cliente/diagnostico',       'cliente.diagnostico'),
    ('/cliente/conteudo',          'cliente.conteudo'),
    ('/cliente/roi',               'cliente.roi'),
    ('/cliente/entregas',          'cliente.entregas'),
    ('/cliente/leads',             'cliente.leads'),
    ('/cliente/clientes',          'cliente.clientes'),
    ('/cliente/atendimento',       'cliente.atendimento'),
    ('/cliente/calendario',        'cliente.calendario'),
    ('/cliente/meta-ads',          'cliente.meta_ads'),
    ('/cliente/conexoes',          'cliente.conexoes')
) AS m(rota, permissao)
CROSS JOIN LATERAL (
  VALUES
    ('super_admin',        m.rota LIKE '/admin/%'),
    ('gestor_estrategico', m.rota IN ('/admin/dashboard','/admin/dashboard-clientes','/admin/clientes',
                                      '/admin/leads','/admin/pipeline-comercial','/admin/diagnosticos',
                                      '/admin/financeiro','/admin/roi')),
    ('growth_manager',     m.rota IN ('/admin/dashboard','/admin/clientes','/admin/leads',
                                      '/admin/pipeline-comercial','/admin/atendimento','/admin/cerebro-pietro',
                                      '/admin/nutricao','/admin/automacoes-leads','/admin/biblioteca-criativa',
                                      '/admin/calendario','/admin/roi')),
    ('social_media',       m.rota IN ('/admin/clientes','/admin/estrategia','/admin/biblioteca-criativa',
                                      '/admin/calendario','/admin/roi')),
    ('performance',        m.rota IN ('/admin/dashboard','/admin/clientes','/admin/meta-ads',
                                      '/admin/config-meta','/admin/roi')),
    ('atendimento_cs',     m.rota IN ('/admin/dashboard','/admin/clientes','/admin/leads',
                                      '/admin/atendimento','/admin/diagnosticos')),
    ('financeiro',         m.rota IN ('/admin/dashboard','/admin/clientes','/admin/financeiro')),
    ('cliente',            m.rota LIKE '/cliente/%')
) AS r(role, permitido);

-- ── 4. Preset derivado da matriz ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.permissoes_do_perfil(_role public.app_role)
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _role = 'super_admin' THEN ARRAY['*']
    ELSE COALESCE(
      (SELECT array_agg(DISTINCT permissao ORDER BY permissao)
         FROM public.roles_permissoes
        WHERE role = _role AND permitido),
      ARRAY[]::text[])
  END;
$$;

COMMENT ON FUNCTION public.permissoes_do_perfil IS
  'Preset de permissões de um perfil, lido da matriz roles_permissoes.';

-- admin_upsert_profile_role passa a usar o preset da matriz quando o chamador
-- não manda permissões explícitas (antes o preset vivia só no frontend).
CREATE OR REPLACE FUNCTION public.admin_upsert_profile_role(
  _user_id uuid,
  _role public.app_role,
  _cliente_id uuid DEFAULT NULL,
  _permissoes text[] DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Mantém o comportamento anterior: chamada sem sessão (service_role, vinda da
  -- edge function admin-create-user) não exige super admin.
  IF auth.uid() IS NOT NULL THEN
    PERFORM public.assert_current_admin();
  END IF;

  INSERT INTO public.profiles(id, cliente_id, permissoes)
    VALUES (_user_id, _cliente_id, COALESCE(_permissoes, public.permissoes_do_perfil(_role)))
    ON CONFLICT (id) DO UPDATE
      SET cliente_id    = EXCLUDED.cliente_id,
          permissoes    = EXCLUDED.permissoes,
          atualizado_em = now();

  INSERT INTO public.user_roles(user_id, role)
    VALUES (_user_id, _role)
    ON CONFLICT (user_id, role) DO NOTHING;
END $$;

-- ── 5. Reaplica os presets nos usuários existentes ──────────────────────────
-- admin.operacao deixou de existir (virou admin.crm / admin.calendario /
-- admin.nutricao), então quem tinha o preset antigo ficaria com permissão órfã.

UPDATE public.profiles p
SET permissoes = public.permissoes_do_perfil(ur.role),
    atualizado_em = now()
FROM public.user_roles ur
WHERE ur.user_id = p.id
  AND NOT (p.permissoes @> ARRAY['*']);

-- ── 6. Último acesso ────────────────────────────────────────────────────────
-- profiles_self é SELECT-only de propósito (o usuário não edita o próprio
-- perfil). O carimbo de acesso entra por função SECURITY DEFINER, que só toca
-- essa coluna e só na própria linha.

CREATE OR REPLACE FUNCTION public.registrar_acesso()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  UPDATE public.profiles SET ultimo_acesso = now() WHERE id = auth.uid();
END $$;

GRANT EXECUTE ON FUNCTION public.registrar_acesso() TO authenticated;
