-- app_config guarda configuração da operação da Tabgha/IAplicada.
-- A policy anterior liberava SELECT para qualquer autenticado, inclusive
-- papel 'cliente'. Leitura passa a ser de staff. Edge Functions usam
-- service role e não são afetadas.

DROP POLICY IF EXISTS app_config_auth_read ON public.app_config;

CREATE POLICY app_config_staff_read
  ON public.app_config
  FOR SELECT
  USING (public.is_staff(auth.uid()));
