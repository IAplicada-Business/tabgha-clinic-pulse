-- Etapa 2 / Fase A — Expandir app_role para os 8 perfis do Blueprint.
-- NÃO altera RLS de tabelas de negócio (vem nas fases seguintes).
--
-- Mapeamento:
--   admin              → Super Admin (já existente; usuários atuais preservados)
--   gestor_estrategico → Gestor Estratégico
--   growth_manager     → Growth Manager
--   social_media       → Social Media
--   performance        → Performance
--   atendimento_cs     → Atendimento/CS
--   financeiro         → Financeiro
--   cliente            → Cliente (já existente)
--
-- PLACEHOLDER — labels/descrições de negócio alinhadas ao Blueprint;
-- matriz fina de permissões por perfil pode ser revisada com Pietro.

-- ADD VALUE não pode ser usado no mesmo transaction em que o novo valor é referenciado
-- como literal. Por isso helpers abaixo usam comparação genérica (<> 'cliente' / ANY).

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gestor_estrategico';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'growth_manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'social_media';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'performance';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'atendimento_cs';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'financeiro';
