-- Etapa 1 · Ativar WhatsApp da Tabgha (instância própria da agência)
--
-- Achado na investigação ao vivo (query read-only rodada nesta sessão): o
-- cliente-pseudo "Tabgha" (id fixo 00000000-0000-0000-0000-000000000001,
-- usado por lp-submit e admin/automacoes-leads.tsx) NÃO existe hoje na
-- tabela clientes deste projeto — a tabela whatsapp_instances tem FK NOT
-- NULL para clientes(id), então o insert abaixo falharia sem reaplicar
-- primeiro o seed original (mesmo bloco de 20260618194242_ajustes_call_18_06.sql,
-- idempotente via ON CONFLICT DO NOTHING).
--
-- O token Z-API é aplicado separadamente (fora desta migration).
-- NÃO aplicar sem confirmação explícita.

INSERT INTO public.clientes (id, nome, especialidade, status, dados_extras)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tabgha Health Marketing',
  'Agência',
  'ativo',
  '{"is_tabgha":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.whatsapp_instances (cliente_id, provider, instance_id, status)
SELECT
  '00000000-0000-0000-0000-000000000001',
  'zapi',
  '3F5940846CC07168D9D4FA3326EF075C',
  'disconnected'
WHERE NOT EXISTS (
  SELECT 1 FROM public.whatsapp_instances
  WHERE cliente_id = '00000000-0000-0000-0000-000000000001'
);
