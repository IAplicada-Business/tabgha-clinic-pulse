-- Etapa 2 · Link público (sem login) do relatório do Diagnóstico das 7 Fontes.
--
-- RECUPERADA DO BANCO: esta migration já estava aplicada em produção
-- (versão 20260731000000) mas o arquivo não existia em nenhuma branch. O DDL
-- abaixo foi reconstruído a partir do schema real para que um ambiente novo
-- (`supabase db reset`) produza o mesmo resultado que a produção.
--
-- A leitura pública é feita pela edge function diagnostico-publico, que usa
-- service_role e filtra por link_token. Nenhuma policy para `anon` é criada:
-- a RLS de diagnostico_relatorios/scores continua staff-only.

ALTER TABLE public.diagnostico_relatorios
  ADD COLUMN IF NOT EXISTS link_token uuid,
  ADD COLUMN IF NOT EXISTS link_expira_em timestamptz;

COMMENT ON COLUMN public.diagnostico_relatorios.link_token IS
  'Token do link público (sem login) do relatório. NULL até a primeira geração pós-migração.';
COMMENT ON COLUMN public.diagnostico_relatorios.link_expira_em IS
  'Expiração do link público — renovada a cada regeneração do relatório (30 dias).';

-- Índice parcial: dois relatórios podem ter link_token NULL, mas um token
-- emitido é único.
CREATE UNIQUE INDEX IF NOT EXISTS diagnostico_relatorios_link_token_key
  ON public.diagnostico_relatorios (link_token)
  WHERE link_token IS NOT NULL;
