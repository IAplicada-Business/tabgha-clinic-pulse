-- app_config guarda configuração da operação da Tabgha/IAplicada: o system
-- prompt do agente, as sequências de nutrição, o template de diagnóstico.
-- A policy anterior liberava SELECT para qualquer usuário autenticado, o que
-- inclui os usuários com papel 'cliente' — ou seja, cada cliente conseguia ler
-- a configuração interna inteira pelo próprio portal.
--
-- Leitura passa a ser de staff. As Edge Functions que dependem dessas chaves
-- (webhook_meta_lead, sync_meta_leads, nurture-tick, ai-respond) usam service
-- role e não são afetadas por RLS.

DROP POLICY IF EXISTS app_config_auth_read ON public.app_config;

CREATE POLICY app_config_staff_read
  ON public.app_config
  FOR SELECT
  USING (public.is_staff(auth.uid()));
