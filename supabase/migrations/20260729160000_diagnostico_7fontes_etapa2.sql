-- Etapa 2 / Fase C — Diagnóstico das 7 Fontes (schema + scoring).
-- NÃO aplicar em produção sem confirmação.
--
-- PLACEHOLDER — revisar com Pietro (Etapa 4):
--   * o conteúdo do questionário (ver migration ..._seed_placeholder.sql);
--   * a RUBRICA DE SCORING por Fonte. O cálculo abaixo é uma média ponderada
--     normalizada 0–100 sobre respostas em escala 1–5 — é um stand-in funcional,
--     não a rubrica oficial do Blueprint.

-- ── Enum das 7 Fontes ────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fonte_diagnostico') THEN
    CREATE TYPE public.fonte_diagnostico AS ENUM (
      'posicionamento',
      'presenca_digital',
      'aquisicao_pacientes',
      'conversao',
      'experiencia_paciente',
      'inteligencia_dados',
      'escala'
    );
  END IF;
END $$;

-- ── Questões ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diagnostico_questoes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text NOT NULL UNIQUE,
  fonte         public.fonte_diagnostico NOT NULL,
  ordem         smallint NOT NULL DEFAULT 1,
  pergunta      text NOT NULL,
  ajuda         text,
  tipo          text NOT NULL DEFAULT 'escala_1_5',
  peso          numeric(4,2) NOT NULL DEFAULT 1,
  -- true = conteúdo provisório, aguardando questionário real do Pietro
  placeholder   boolean NOT NULL DEFAULT true,
  ativa         boolean NOT NULL DEFAULT true,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostico_questoes_tipo_check
    CHECK (tipo IN ('escala_1_5', 'sim_nao', 'texto'))
);

CREATE INDEX IF NOT EXISTS idx_diag_questoes_fonte_ordem
  ON public.diagnostico_questoes(fonte, ordem);

-- ── Respostas ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diagnostico_respostas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  questao_id      uuid NOT NULL REFERENCES public.diagnostico_questoes(id) ON DELETE CASCADE,
  valor_num       smallint,
  valor_texto     text,
  respondido_por  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostico_respostas_unica UNIQUE (cliente_id, questao_id),
  CONSTRAINT diagnostico_respostas_valor_check
    CHECK (valor_num IS NULL OR valor_num BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_diag_respostas_cliente
  ON public.diagnostico_respostas(cliente_id);

-- ── Scores por Fonte (mantido pelo trigger, nunca escrito pela UI) ───────────
CREATE TABLE IF NOT EXISTS public.diagnostico_scores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id     uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  fonte          public.fonte_diagnostico NOT NULL,
  score          numeric(5,2),
  respondidas    smallint NOT NULL DEFAULT 0,
  total          smallint NOT NULL DEFAULT 0,
  atualizado_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostico_scores_unico UNIQUE (cliente_id, fonte)
);

CREATE INDEX IF NOT EXISTS idx_diag_scores_cliente
  ON public.diagnostico_scores(cliente_id);

-- ── Recálculo de score ───────────────────────────────────────────────────────
-- PLACEHOLDER — rubrica pendente de validação com o Pietro (Etapa 4).
CREATE OR REPLACE FUNCTION public.recalcular_diagnostico_score(
  _cliente_id uuid,
  _fonte public.fonte_diagnostico
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _total       smallint;
  _respondidas smallint;
  _score       numeric(5,2);
BEGIN
  SELECT COUNT(*)
    INTO _total
  FROM public.diagnostico_questoes q
  WHERE q.fonte = _fonte
    AND q.ativa
    AND q.tipo <> 'texto';

  SELECT
    COUNT(*) FILTER (WHERE r.valor_num IS NOT NULL),
    CASE
      WHEN COALESCE(SUM(q.peso) FILTER (WHERE r.valor_num IS NOT NULL), 0) > 0 THEN
        ROUND(
          SUM(q.peso * r.valor_num) FILTER (WHERE r.valor_num IS NOT NULL)
          / (SUM(q.peso) FILTER (WHERE r.valor_num IS NOT NULL) * 5) * 100,
          2
        )
      ELSE NULL
    END
    INTO _respondidas, _score
  FROM public.diagnostico_respostas r
  JOIN public.diagnostico_questoes q ON q.id = r.questao_id
  WHERE r.cliente_id = _cliente_id
    AND q.fonte = _fonte
    AND q.ativa;

  IF COALESCE(_respondidas, 0) = 0 THEN
    DELETE FROM public.diagnostico_scores
    WHERE cliente_id = _cliente_id AND fonte = _fonte;
    RETURN;
  END IF;

  INSERT INTO public.diagnostico_scores
    (cliente_id, fonte, score, respondidas, total, atualizado_em)
  VALUES
    (_cliente_id, _fonte, _score, _respondidas, COALESCE(_total, 0), now())
  ON CONFLICT (cliente_id, fonte) DO UPDATE
    SET score         = EXCLUDED.score,
        respondidas   = EXCLUDED.respondidas,
        total         = EXCLUDED.total,
        atualizado_em = now();
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.recalcular_diagnostico_score(uuid, public.fonte_diagnostico)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.tg_diagnostico_respostas_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cliente uuid;
  _questao uuid;
  _fonte   public.fonte_diagnostico;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _cliente := OLD.cliente_id;
    _questao := OLD.questao_id;
  ELSE
    _cliente := NEW.cliente_id;
    _questao := NEW.questao_id;
  END IF;

  SELECT q.fonte INTO _fonte
  FROM public.diagnostico_questoes q
  WHERE q.id = _questao;

  IF _fonte IS NOT NULL THEN
    PERFORM public.recalcular_diagnostico_score(_cliente, _fonte);
  END IF;

  -- resposta remanejada para outra questão/cliente: recalcula também o par antigo
  IF TG_OP = 'UPDATE'
     AND (NEW.questao_id IS DISTINCT FROM OLD.questao_id
          OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id) THEN
    SELECT q.fonte INTO _fonte
    FROM public.diagnostico_questoes q
    WHERE q.id = OLD.questao_id;
    IF _fonte IS NOT NULL THEN
      PERFORM public.recalcular_diagnostico_score(OLD.cliente_id, _fonte);
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_diagnostico_respostas_score ON public.diagnostico_respostas;
CREATE TRIGGER trg_diagnostico_respostas_score
AFTER INSERT OR UPDATE OR DELETE ON public.diagnostico_respostas
FOR EACH ROW EXECUTE FUNCTION public.tg_diagnostico_respostas_score();

CREATE OR REPLACE FUNCTION public.tg_diagnostico_respostas_touch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_diagnostico_respostas_touch ON public.diagnostico_respostas;
CREATE TRIGGER trg_diagnostico_respostas_touch
BEFORE UPDATE ON public.diagnostico_respostas
FOR EACH ROW EXECUTE FUNCTION public.tg_diagnostico_respostas_touch();

-- ── RLS ──────────────────────────────────────────────────────────────────────
GRANT SELECT ON public.diagnostico_questoes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.diagnostico_questoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostico_respostas TO authenticated;
GRANT SELECT ON public.diagnostico_scores TO authenticated;
GRANT ALL ON public.diagnostico_questoes,
             public.diagnostico_respostas,
             public.diagnostico_scores TO service_role;

ALTER TABLE public.diagnostico_questoes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostico_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostico_scores    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diag_questoes_leitura ON public.diagnostico_questoes;
CREATE POLICY diag_questoes_leitura ON public.diagnostico_questoes
  FOR SELECT USING (ativa OR public.is_staff(auth.uid()));

DROP POLICY IF EXISTS diag_questoes_admin ON public.diagnostico_questoes;
CREATE POLICY diag_questoes_admin ON public.diagnostico_questoes
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS diag_respostas_cliente ON public.diagnostico_respostas;
CREATE POLICY diag_respostas_cliente ON public.diagnostico_respostas
  FOR ALL
  USING (cliente_id = public.current_cliente_id())
  WITH CHECK (cliente_id = public.current_cliente_id());

DROP POLICY IF EXISTS diag_respostas_staff ON public.diagnostico_respostas;
CREATE POLICY diag_respostas_staff ON public.diagnostico_respostas
  FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS diag_scores_leitura ON public.diagnostico_scores;
CREATE POLICY diag_scores_leitura ON public.diagnostico_scores
  FOR SELECT
  USING (cliente_id = public.current_cliente_id() OR public.is_staff(auth.uid()));

-- ── Score consolidado ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.vw_diagnostico_score_geral AS
SELECT
  cliente_id,
  ROUND(AVG(score), 2)                          AS score_geral,
  COUNT(*)::smallint                            AS fontes_com_resposta,
  SUM(respondidas)::int                         AS respostas_total,
  MAX(atualizado_em)                            AS atualizado_em
FROM public.diagnostico_scores
WHERE score IS NOT NULL
GROUP BY cliente_id;

GRANT SELECT ON public.vw_diagnostico_score_geral TO authenticated, service_role;

COMMENT ON TABLE public.diagnostico_questoes IS
  'Etapa 2 Fase C: questionário das 7 Fontes. placeholder=true → conteúdo provisório, pendente do Pietro (Etapa 4).';
COMMENT ON FUNCTION public.recalcular_diagnostico_score(uuid, public.fonte_diagnostico) IS
  'PLACEHOLDER: média ponderada 0–100. Rubrica oficial por Fonte pendente de validação com o Pietro.';
