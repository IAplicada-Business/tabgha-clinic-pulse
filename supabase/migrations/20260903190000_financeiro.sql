-- Visão Financeira · contratos, cobranças, MRR e inadimplência.
--
-- Decisões anti-duplicação:
--   * Um menu só ("Financeiro") com 4 abas em ?tab=, no mesmo padrão que
--     /admin/roi já usa — não são 4 rotas nem 4 itens de menu.
--   * Nenhuma tabela de "pagamentos" separada: a fatura guarda valor_pago e
--     data_pagamento. Cobrança e pagamento são a mesma linha do funil.
--   * O status "vencida" NÃO é gravado (exigiria cron para virar o dia). Fica
--     derivado de vencimento < hoje em faturas ainda a_vencer — a view e o
--     frontend usam a mesma regra (src/lib/financeiro.ts).
--   * Acesso pela matriz do item 8: admin.financeiro → super_admin,
--     gestor_estrategico e financeiro.

-- ── Contratos ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  plano text NOT NULL DEFAULT 'Essencial',
  valor_mensal numeric(12,2) NOT NULL DEFAULT 0 CHECK (valor_mensal >= 0),
  data_assinatura date NOT NULL DEFAULT current_date,
  vigencia_inicio date NOT NULL DEFAULT current_date,
  vigencia_fim date,
  dia_vencimento int NOT NULL DEFAULT 10 CHECK (dia_vencimento BETWEEN 1 AND 28),
  status text NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'pausado', 'suspenso', 'encerrado')),
  observacoes text,
  /* clausulas resumidas, histórico de renegociação, aditivos */
  metadados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contratos_cliente ON public.contratos (cliente_id, status);

DROP TRIGGER IF EXISTS trg_contratos_updated ON public.contratos;
CREATE TRIGGER trg_contratos_updated
  BEFORE UPDATE ON public.contratos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Faturas (cobrança + pagamento na mesma linha) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.faturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.contratos(id) ON DELETE SET NULL,
  descricao text NOT NULL DEFAULT 'Mensalidade',
  valor numeric(12,2) NOT NULL CHECK (valor >= 0),
  valor_pago numeric(12,2),
  vencimento date NOT NULL,
  data_pagamento date,
  status text NOT NULL DEFAULT 'a_vencer'
    CHECK (status IN ('a_vencer', 'paga', 'cancelada')),
  metodo text NOT NULL DEFAULT 'pix' CHECK (metodo IN ('boleto', 'pix', 'cartao')),
  recorrencia text NOT NULL DEFAULT 'mensal'
    CHECK (recorrencia IN ('unica', 'mensal', 'anual')),
  link_pagamento text,
  notificada_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.faturas.status IS
  'a_vencer | paga | cancelada. "vencida" é derivado (vencimento < hoje e status a_vencer).';

CREATE INDEX IF NOT EXISTS idx_faturas_cliente ON public.faturas (cliente_id, vencimento DESC);
CREATE INDEX IF NOT EXISTS idx_faturas_status ON public.faturas (status, vencimento);
CREATE INDEX IF NOT EXISTS idx_faturas_pagamento ON public.faturas (data_pagamento)
  WHERE data_pagamento IS NOT NULL;

DROP TRIGGER IF EXISTS trg_faturas_updated ON public.faturas;
CREATE TRIGGER trg_faturas_updated
  BEFORE UPDATE ON public.faturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Quem enxerga finanças na matriz do item 8: super_admin, gestor_estrategico
-- e financeiro. O cliente vê as próprias faturas (só leitura).

ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.pode_ver_financeiro(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(
    _user_id,
    ARRAY['super_admin'::public.app_role,
          'gestor_estrategico'::public.app_role,
          'financeiro'::public.app_role]
  );
$$;

DROP POLICY IF EXISTS contratos_financeiro_all ON public.contratos;
CREATE POLICY contratos_financeiro_all ON public.contratos
  FOR ALL
  USING (public.pode_ver_financeiro(auth.uid()))
  WITH CHECK (public.pode_ver_financeiro(auth.uid()));

DROP POLICY IF EXISTS contratos_cliente_select ON public.contratos;
CREATE POLICY contratos_cliente_select ON public.contratos
  FOR SELECT USING (cliente_id = public.current_cliente_id());

DROP POLICY IF EXISTS faturas_financeiro_all ON public.faturas;
CREATE POLICY faturas_financeiro_all ON public.faturas
  FOR ALL
  USING (public.pode_ver_financeiro(auth.uid()))
  WITH CHECK (public.pode_ver_financeiro(auth.uid()));

DROP POLICY IF EXISTS faturas_cliente_select ON public.faturas;
CREATE POLICY faturas_cliente_select ON public.faturas
  FOR SELECT USING (cliente_id = public.current_cliente_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faturas TO authenticated;
GRANT ALL ON public.contratos TO service_role;
GRANT ALL ON public.faturas TO service_role;

-- ── Views dos 4 cards ───────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.vw_financeiro_resumo
WITH (security_invoker = true) AS
SELECT
  (SELECT COALESCE(SUM(valor_mensal), 0) FROM public.contratos WHERE status = 'ativo')
    AS mrr_ativo,
  (SELECT COALESCE(SUM(valor_mensal), 0) FROM public.contratos
     WHERE status = 'ativo'
       AND data_assinatura < date_trunc('month', current_date)::date)
    AS mrr_mes_anterior,
  (SELECT COALESCE(SUM(valor_pago), 0) FROM public.faturas
     WHERE status = 'paga'
       AND data_pagamento >= date_trunc('month', current_date)::date)
    AS recebido_mes,
  (SELECT COALESCE(SUM(valor), 0) FROM public.faturas
     WHERE status <> 'cancelada'
       AND vencimento >= date_trunc('month', current_date)::date
       AND vencimento < (date_trunc('month', current_date) + interval '1 month')::date)
    AS previsto_mes,
  (SELECT COALESCE(SUM(valor), 0) FROM public.faturas WHERE status = 'a_vencer')
    AS cobrancas_abertas,
  (SELECT COUNT(*) FROM public.faturas WHERE status = 'a_vencer')
    AS cobrancas_abertas_qtd,
  (SELECT COALESCE(SUM(valor), 0) FROM public.faturas
     WHERE status = 'a_vencer' AND vencimento < current_date - 5)
    AS inadimplencia,
  (SELECT COUNT(DISTINCT cliente_id) FROM public.faturas
     WHERE status = 'a_vencer' AND vencimento < current_date - 5)
    AS inadimplentes_qtd;

COMMENT ON VIEW public.vw_financeiro_resumo IS
  'Os 4 cards financeiros do dashboard. security_invoker: respeita a RLS de quem consulta.';

-- Evolução do MRR nos últimos 12 meses.
CREATE OR REPLACE VIEW public.vw_mrr_mensal
WITH (security_invoker = true) AS
WITH meses AS (
  SELECT generate_series(
    date_trunc('month', current_date) - interval '11 months',
    date_trunc('month', current_date),
    interval '1 month'
  )::date AS mes
)
SELECT
  m.mes,
  COALESCE(SUM(c.valor_mensal) FILTER (
    WHERE c.vigencia_inicio <= (m.mes + interval '1 month' - interval '1 day')::date
      AND (c.vigencia_fim IS NULL OR c.vigencia_fim >= m.mes)
      AND c.status <> 'encerrado'
  ), 0) AS mrr,
  COALESCE(SUM(c.valor_mensal) FILTER (
    WHERE date_trunc('month', c.vigencia_inicio)::date = m.mes
  ), 0) AS novo,
  COALESCE(SUM(c.valor_mensal) FILTER (
    WHERE c.vigencia_fim IS NOT NULL
      AND date_trunc('month', c.vigencia_fim)::date = m.mes
  ), 0) AS churn
FROM meses m
LEFT JOIN public.contratos c ON true
GROUP BY m.mes
ORDER BY m.mes;

COMMENT ON VIEW public.vw_mrr_mensal IS
  'MRR mês a mês (12 meses) para o gráfico da aba MRR.';

GRANT SELECT ON public.vw_financeiro_resumo TO authenticated;
GRANT SELECT ON public.vw_mrr_mensal TO authenticated;

-- ── Ações do rito de inadimplência ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.marcar_fatura_paga(_id uuid, _valor numeric DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cliente uuid;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.faturas
  SET status = 'paga',
      valor_pago = COALESCE(_valor, valor),
      data_pagamento = current_date,
      atualizado_em = now()
  WHERE id = _id AND status <> 'cancelada'
  RETURNING cliente_id INTO v_cliente;

  IF v_cliente IS NULL THEN
    RAISE EXCEPTION 'fatura não encontrada ou cancelada';
  END IF;

  INSERT INTO public.automation_logs (cliente_id, action, metadata)
  VALUES (v_cliente, 'fatura_paga', jsonb_build_object('fatura_id', _id, 'by', auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.suspender_contrato(_contrato_id uuid, _motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cliente uuid;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.contratos
  SET status = 'suspenso',
      metadados = metadados || jsonb_build_object(
        'suspenso_em', now(),
        'suspenso_motivo', COALESCE(_motivo, 'inadimplência'),
        'suspenso_por', auth.uid()
      ),
      atualizado_em = now()
  WHERE id = _contrato_id
  RETURNING cliente_id INTO v_cliente;

  IF v_cliente IS NULL THEN RAISE EXCEPTION 'contrato não encontrado'; END IF;

  -- O rito de suspensão bloqueia o acesso do cliente à plataforma.
  UPDATE public.profiles SET ativo = false, atualizado_em = now()
  WHERE cliente_id = v_cliente;

  INSERT INTO public.automation_logs (cliente_id, action, metadata)
  VALUES (v_cliente, 'contrato_suspenso',
    jsonb_build_object('contrato_id', _contrato_id, 'motivo', _motivo, 'by', auth.uid()));
END $$;

CREATE OR REPLACE FUNCTION public.reativar_contrato(_contrato_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cliente uuid;
BEGIN
  IF NOT public.pode_ver_financeiro(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.contratos
  SET status = 'ativo',
      metadados = metadados || jsonb_build_object('reativado_em', now(), 'reativado_por', auth.uid()),
      atualizado_em = now()
  WHERE id = _contrato_id
  RETURNING cliente_id INTO v_cliente;

  IF v_cliente IS NULL THEN RAISE EXCEPTION 'contrato não encontrado'; END IF;

  UPDATE public.profiles SET ativo = true, atualizado_em = now()
  WHERE cliente_id = v_cliente;

  INSERT INTO public.automation_logs (cliente_id, action, metadata)
  VALUES (v_cliente, 'contrato_reativado',
    jsonb_build_object('contrato_id', _contrato_id, 'by', auth.uid()));
END $$;

GRANT EXECUTE ON FUNCTION public.marcar_fatura_paga(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.suspender_contrato(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reativar_contrato(uuid) TO authenticated;
