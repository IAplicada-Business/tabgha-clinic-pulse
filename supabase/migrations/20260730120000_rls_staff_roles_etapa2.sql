-- Etapa 2 / Fase B — RLS fina para os 6 perfis novos (staff) nas tabelas de negócio.
--
-- Contexto: a Etapa 2 / Fase A (20260729140000_rbac_perfis_etapa2.sql) expandiu
-- app_role de 2 pra 8 valores e o front (route-permissions.ts) já bloqueia
-- navegação por rota para cada perfil. Mas RLS é o gate real de dados — e até
-- esta migration, toda policy de tabela de negócio checava só 'admin'
-- (public.has_role(auth.uid(),'admin')), então os 5 perfis novos além de
-- growth_manager (que só ganhou acesso em oportunidades_b2b) navegavam pras
-- telas mas toda query Supabase retornava vazio.
--
-- Escopo: SOMENTE SELECT. Mapeamento verificado contra o uso real de cada
-- tabela nas rotas admin (grep .from("...") em src/routes/_authenticated/admin),
-- não apenas contra o nome do grupo de permissão — por isso:
--   - clientes / leads / conteudos: expostos por src/routes/_authenticated/
--     admin/clientes/$id.tsx, que só é gateada por "clientes" (todo perfil novo
--     tem essa permissão) — liberar pros 6 é só reconhecer o que já é visível
--     ali. Sensibilidade baixa (dados de conta e conteúdo de marketing).
--   - metricas_ads / entregas: só aparecem em rotas com permissão "dashboard"/
--     "roi"/"meta_ads" (admin/dashboard.tsx, admin/roi.tsx, admin/dashboard-
--     -clientes.tsx, MetaAdsPage) — restrito a quem tem essas permissões
--     (gestor_estrategico, growth_manager, performance, financeiro).
--   - whatsapp_conversations / whatsapp_messages: dado sensível (conversas
--     reais de pacientes/leads). Só liberado pra atendimento_cs, o único
--     perfil com a permissão "atendimento" (rota admin/atendimento). A
--     tela admin/clientes/$id.tsx também faz essa query pra todo mundo com
--     "clientes", então perfis fora do atendimento vão ver essa aba vazia
--     ali — intencional (defesa em profundidade); esconder a aba pra esses
--     perfis no front é item de follow-up, não bloqueia esta migration.
--
-- Não concede INSERT/UPDATE/DELETE pros novos perfis — quem pode editar o quê
-- é decisão de produto ainda em aberto (permissions.ts:90-95 marca o preset
-- atual como "placeholder, não validado com o Pietro").
--
-- Fora do escopo (propositalmente, sem consumidor hoje):
--   - agendamentos / nurture_jobs: nenhuma rota admin faz .from() nelas hoje
--     (só telas do cliente, já cobertas pelas policies *_cliente_select
--     existentes). Sem tela pra ler, não há motivo pra abrir RLS ainda.
--   - whatsapp_instances: guarda token/instance_id da Z-API em texto puro —
--     continua admin-only.
--   - profiles / user_roles: gestão de usuário continua admin-only, nenhum
--     preset de rota concede acesso a "usuarios" pros 6 perfis novos.

-- clientes / leads / conteudos — todos os 6 perfis novos alcançam via /admin/clientes/$id.
DROP POLICY IF EXISTS clientes_staff_select ON public.clientes;
CREATE POLICY clientes_staff_select ON public.clientes FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY[
    'gestor_estrategico'::public.app_role,
    'growth_manager'::public.app_role,
    'social_media'::public.app_role,
    'performance'::public.app_role,
    'atendimento_cs'::public.app_role,
    'financeiro'::public.app_role
  ]));

DROP POLICY IF EXISTS leads_staff_select ON public.leads;
CREATE POLICY leads_staff_select ON public.leads FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY[
    'gestor_estrategico'::public.app_role,
    'growth_manager'::public.app_role,
    'social_media'::public.app_role,
    'performance'::public.app_role,
    'atendimento_cs'::public.app_role,
    'financeiro'::public.app_role
  ]));

DROP POLICY IF EXISTS conteudos_staff_select ON public.conteudos;
CREATE POLICY conteudos_staff_select ON public.conteudos FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY[
    'gestor_estrategico'::public.app_role,
    'growth_manager'::public.app_role,
    'social_media'::public.app_role,
    'performance'::public.app_role,
    'atendimento_cs'::public.app_role,
    'financeiro'::public.app_role
  ]));

-- metricas_ads / entregas — só quem tem "dashboard"/"roi"/"meta_ads" no preset,
-- únicas rotas admin que fazem .from() nessas tabelas.
DROP POLICY IF EXISTS metricas_ads_staff_select ON public.metricas_ads;
CREATE POLICY metricas_ads_staff_select ON public.metricas_ads FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY[
    'gestor_estrategico'::public.app_role,
    'growth_manager'::public.app_role,
    'performance'::public.app_role,
    'financeiro'::public.app_role
  ]));

DROP POLICY IF EXISTS entregas_staff_select ON public.entregas;
CREATE POLICY entregas_staff_select ON public.entregas FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY[
    'gestor_estrategico'::public.app_role,
    'growth_manager'::public.app_role,
    'performance'::public.app_role,
    'financeiro'::public.app_role
  ]));

-- whatsapp_conversations / whatsapp_messages — dado sensível, só atendimento_cs.
DROP POLICY IF EXISTS wpp_conv_staff_select ON public.whatsapp_conversations;
CREATE POLICY wpp_conv_staff_select ON public.whatsapp_conversations FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['atendimento_cs'::public.app_role]));

DROP POLICY IF EXISTS wpp_msg_staff_select ON public.whatsapp_messages;
CREATE POLICY wpp_msg_staff_select ON public.whatsapp_messages FOR SELECT
  USING (public.has_any_role(auth.uid(), ARRAY['atendimento_cs'::public.app_role]));
