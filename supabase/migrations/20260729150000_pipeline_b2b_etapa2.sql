-- Etapa 2 / Fase B — Pipeline comercial B2B (paralelo ao funil de leads/paciente).
-- RLS: Super Admin (admin) + Growth Manager.
-- NÃO aplicar em produção sem confirmação.

-- ── Tabela ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.oportunidades_b2b (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            text NOT NULL,
  email           text,
  telefone        text,
  origem          text,
  especialidade   text,
  cidade          text,
  canal           text,
  responsavel_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ticket          numeric(12,2),
  roi             numeric(12,4),
  cac             numeric(12,2),
  status          text NOT NULL DEFAULT 'novo_lead',
  observacoes     text,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT oportunidades_b2b_status_check CHECK (
    status IN (
      'novo_lead',
      'contato_iniciado',
      'diagnostico_agendado',
      'proposta_enviada',
      'negociacao',
      'cliente_ativo',
      'pos_venda',
      'cliente_promotor'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_oportunidades_b2b_status ON public.oportunidades_b2b(status);
CREATE INDEX IF NOT EXISTS idx_oportunidades_b2b_responsavel ON public.oportunidades_b2b(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_oportunidades_b2b_criado ON public.oportunidades_b2b(criado_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades_b2b TO authenticated;
GRANT ALL ON public.oportunidades_b2b TO service_role;

ALTER TABLE public.oportunidades_b2b ENABLE ROW LEVEL SECURITY;

-- ── RLS: admin + growth_manager ──────────────────────────────────────────────
DROP POLICY IF EXISTS oportunidades_b2b_staff ON public.oportunidades_b2b;
CREATE POLICY oportunidades_b2b_staff ON public.oportunidades_b2b
  FOR ALL
  USING (
    public.has_any_role(
      auth.uid(),
      ARRAY['admin'::public.app_role, 'growth_manager'::public.app_role]
    )
  )
  WITH CHECK (
    public.has_any_role(
      auth.uid(),
      ARRAY['admin'::public.app_role, 'growth_manager'::public.app_role]
    )
  );

-- ── RPC mover estágio ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mover_oportunidade_b2b_status(
  _id uuid,
  _novo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _novo NOT IN (
    'novo_lead','contato_iniciado','diagnostico_agendado','proposta_enviada',
    'negociacao','cliente_ativo','pos_venda','cliente_promotor'
  ) THEN
    RAISE EXCEPTION 'status inválido: %', _novo;
  END IF;

  IF NOT public.has_any_role(
    auth.uid(),
    ARRAY['admin'::public.app_role, 'growth_manager'::public.app_role]
  ) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.oportunidades_b2b
  SET status = _novo, atualizado_em = now()
  WHERE id = _id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'oportunidade não encontrada';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mover_oportunidade_b2b_status(uuid, text)
  TO authenticated, service_role;

-- ── KPIs B2B (espelha o padrão de vw_kpis_cliente_diario) ────────────────────
-- MRR: soma de ticket nos estágios "ganhos" (cliente ativo em diante)
-- Taxa de fechamento: ganhos / total
-- Ticket médio: média de ticket nos ganhos
CREATE OR REPLACE VIEW public.vw_kpis_pipeline_b2b AS
SELECT
  COUNT(*)::bigint AS total_oportunidades,
  COUNT(*) FILTER (
    WHERE status IN ('cliente_ativo', 'pos_venda', 'cliente_promotor')
  )::bigint AS fechados,
  COUNT(*) FILTER (
    WHERE status IN ('novo_lead', 'contato_iniciado', 'diagnostico_agendado',
                     'proposta_enviada', 'negociacao')
  )::bigint AS em_andamento,
  CASE
    WHEN COUNT(*) > 0 THEN
      ROUND(
        (
          COUNT(*) FILTER (
            WHERE status IN ('cliente_ativo', 'pos_venda', 'cliente_promotor')
          )::numeric
          / COUNT(*)::numeric
        ) * 100,
        2
      )
    ELSE NULL
  END AS taxa_fechamento_pct,
  COALESCE(
    SUM(ticket) FILTER (
      WHERE status IN ('cliente_ativo', 'pos_venda', 'cliente_promotor')
        AND ticket IS NOT NULL
    ),
    0
  )::numeric(12,2) AS mrr,
  CASE
    WHEN COUNT(*) FILTER (
      WHERE status IN ('cliente_ativo', 'pos_venda', 'cliente_promotor')
        AND ticket IS NOT NULL
    ) > 0 THEN
      ROUND(
        AVG(ticket) FILTER (
          WHERE status IN ('cliente_ativo', 'pos_venda', 'cliente_promotor')
            AND ticket IS NOT NULL
        ),
        2
      )
    ELSE NULL
  END AS ticket_medio_b2b
FROM public.oportunidades_b2b;

GRANT SELECT ON public.vw_kpis_pipeline_b2b TO authenticated, service_role;

CREATE OR REPLACE VIEW public.vw_funil_oportunidades_b2b AS
SELECT
  status,
  COUNT(*)::bigint AS total,
  AVG(EXTRACT(EPOCH FROM (atualizado_em - criado_em)) / 3600.0) AS horas_no_estagio,
  COALESCE(SUM(ticket), 0)::numeric(12,2) AS ticket_soma
FROM public.oportunidades_b2b
GROUP BY status;

GRANT SELECT ON public.vw_funil_oportunidades_b2b TO authenticated, service_role;

COMMENT ON TABLE public.oportunidades_b2b IS
  'Etapa 2 Fase B: pipeline comercial B2B (clínicas/prospects), paralelo a leads (pacientes).';
COMMENT ON VIEW public.vw_kpis_pipeline_b2b IS
  'KPIs B2B: MRR, taxa de fechamento (%), ticket médio — espelho de vw_kpis_cliente_diario.';
