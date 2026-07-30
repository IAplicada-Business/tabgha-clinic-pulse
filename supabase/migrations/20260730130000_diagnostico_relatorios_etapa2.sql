-- Etapa 2 / Fase C (cont.) — Relatório gerado por IA do Diagnóstico 7 Fontes.
--
-- Guarda o diagnóstico executivo + oportunidades + plano de ação por Fonte,
-- gerado pela edge function gerar-diagnostico-7f a partir de
-- diagnostico_respostas/diagnostico_scores. Um relatório "atual" por cliente
-- (upsert por cliente_id) — não é histórico versionado.
--
-- Conteúdo é tão placeholder quanto o questionário/rubrica que o alimenta
-- (diagnostico_questoes.placeholder = true) — pendente de validação com o
-- Pietro, mas o mecanismo (gerar, salvar, exibir, exportar) já pode ser
-- construído e testado ponta a ponta.

CREATE TABLE IF NOT EXISTS public.diagnostico_relatorios (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id        uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  resumo_executivo  text,
  por_fonte         jsonb NOT NULL DEFAULT '{}'::jsonb,
  score_geral       numeric(5,2),
  gerado_por        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  gerado_em         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostico_relatorios_cliente_unico UNIQUE (cliente_id)
);

CREATE INDEX IF NOT EXISTS idx_diag_relatorios_cliente
  ON public.diagnostico_relatorios(cliente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostico_relatorios TO authenticated;
GRANT ALL ON public.diagnostico_relatorios TO service_role;

ALTER TABLE public.diagnostico_relatorios ENABLE ROW LEVEL SECURITY;

-- Só staff (admin + os 6 perfis novos) — mesmo padrão de diag_respostas_staff.
-- Fora de escopo por ora: acesso do próprio cliente ao relatório (o pedido
-- desta rodada é a tela ADMIN; expor pro cliente é decisão separada).
DROP POLICY IF EXISTS diag_relatorios_staff ON public.diagnostico_relatorios;
CREATE POLICY diag_relatorios_staff ON public.diagnostico_relatorios
  FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

COMMENT ON TABLE public.diagnostico_relatorios IS
  'Etapa 2 Fase C: relatório IA (executivo + oportunidades + plano por Fonte). PLACEHOLDER — conteúdo depende do questionário/rubrica real (Pietro).';
