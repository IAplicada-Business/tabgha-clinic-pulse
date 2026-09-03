-- Biblioteca Criativa.
--
-- Decisões anti-duplicação:
--   * NÃO cria tabela "criativos". O módulo de aprovação de conteúdo já existe
--     como public.conteudos + /cliente/conteudo; a Biblioteca é a evolução
--     dessa tabela (pilar, formato, legenda, tags, versões, autor), não um
--     módulo paralelo. Não existe rota /admin/aprovacao-conteudo no sistema,
--     então não há redirect a fazer — a migração de registros pedida no
--     briefing é a normalização de status abaixo.
--   * O portal do cliente continua em /cliente/conteudo (não se cria
--     /portal/aprovacao-conteudo): é a mesma tela, com os 3 botões do briefing.
--   * Comentários ganham tabela própria porque não existia nada equivalente.

-- ── 1. conteudos vira o registro do criativo ────────────────────────────────

ALTER TABLE public.conteudos
  ADD COLUMN IF NOT EXISTS pilar text NOT NULL DEFAULT 'autoridade',
  ADD COLUMN IF NOT EXISTS formato text NOT NULL DEFAULT 'imagem',
  ADD COLUMN IF NOT EXISTS legenda text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS versao int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS versao_de uuid REFERENCES public.conteudos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS autor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS data_sugerida date,
  ADD COLUMN IF NOT EXISTS arquivos jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS historico jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.conteudos.arquivos IS
  'Lista de {path, tipo, nome} no bucket criativos. Carrossel guarda vários.';
COMMENT ON COLUMN public.conteudos.historico IS
  'Eventos do criativo: {evento, por, em, texto}. Alimenta a linha do tempo.';

-- Vocabulário de status do briefing. A tabela estava vazia, mas o UPDATE
-- deixa a migração correta caso rode em base com dados.
UPDATE public.conteudos SET status = 'rascunho'
  WHERE status IN ('briefing', 'roteiro', 'producao');
UPDATE public.conteudos SET status = 'pendente_aprovacao' WHERE status = 'aprovacao';
UPDATE public.conteudos SET status = 'aprovado' WHERE status IN ('agendado', 'postado');

ALTER TABLE public.conteudos DROP CONSTRAINT IF EXISTS conteudos_status_check;
ALTER TABLE public.conteudos ADD CONSTRAINT conteudos_status_check
  CHECK (status IN ('rascunho', 'pendente_aprovacao', 'aprovado', 'pedir_ajuste', 'arquivado'));

ALTER TABLE public.conteudos ALTER COLUMN status SET DEFAULT 'rascunho';

ALTER TABLE public.conteudos DROP CONSTRAINT IF EXISTS conteudos_pilar_check;
ALTER TABLE public.conteudos ADD CONSTRAINT conteudos_pilar_check
  CHECK (pilar IN ('autoridade', 'relacionamento', 'conversao', 'reputacao'));

ALTER TABLE public.conteudos DROP CONSTRAINT IF EXISTS conteudos_formato_check;
ALTER TABLE public.conteudos ADD CONSTRAINT conteudos_formato_check
  CHECK (formato IN ('imagem', 'video', 'carrossel', 'story', 'texto'));

CREATE INDEX IF NOT EXISTS idx_conteudos_status ON public.conteudos (status, atualizado_em DESC);
CREATE INDEX IF NOT EXISTS idx_conteudos_cliente_pilar ON public.conteudos (cliente_id, pilar);
CREATE INDEX IF NOT EXISTS idx_conteudos_versao_de ON public.conteudos (versao_de)
  WHERE versao_de IS NOT NULL;

-- ── 2. Comentários (chat inline do criativo) ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.conteudo_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_id uuid NOT NULL REFERENCES public.conteudos(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  autor_nome text,
  /* equipe | cliente — para alinhar o balão na direita ou na esquerda */
  autor_lado text NOT NULL DEFAULT 'equipe' CHECK (autor_lado IN ('equipe', 'cliente')),
  texto text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conteudo_comentarios ON public.conteudo_comentarios
  (conteudo_id, criado_em);

ALTER TABLE public.conteudo_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS conteudo_comentarios_staff_all ON public.conteudo_comentarios;
CREATE POLICY conteudo_comentarios_staff_all ON public.conteudo_comentarios
  FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS conteudo_comentarios_cliente_select ON public.conteudo_comentarios;
CREATE POLICY conteudo_comentarios_cliente_select ON public.conteudo_comentarios
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.conteudos c
    WHERE c.id = conteudo_id AND c.cliente_id = public.current_cliente_id()
  ));

DROP POLICY IF EXISTS conteudo_comentarios_cliente_insert ON public.conteudo_comentarios;
CREATE POLICY conteudo_comentarios_cliente_insert ON public.conteudo_comentarios
  FOR INSERT
  WITH CHECK (
    autor_lado = 'cliente'
    AND EXISTS (
      SELECT 1 FROM public.conteudos c
      WHERE c.id = conteudo_id AND c.cliente_id = public.current_cliente_id()
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conteudo_comentarios TO authenticated;
GRANT ALL ON public.conteudo_comentarios TO service_role;

-- ── 3. Resposta do cliente com o vocabulário novo ───────────────────────────
-- responder_conteudo passa a aceitar aprovar, pedir ajuste e rejeitar, e a
-- registrar o evento no histórico do criativo.

CREATE OR REPLACE FUNCTION public.responder_conteudo(
  _id uuid,
  _aprovada boolean,
  _feedback text DEFAULT NULL,
  _acao text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_acao text;
  v_novo_status text;
  v_quem text;
BEGIN
  IF public.current_cliente_id() IS NULL AND NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  v_acao := COALESCE(_acao, CASE WHEN _aprovada THEN 'aprovar' ELSE 'pedir_ajuste' END);
  v_novo_status := CASE v_acao
    WHEN 'aprovar' THEN 'aprovado'
    WHEN 'rejeitar' THEN 'arquivado'
    ELSE 'pedir_ajuste'
  END;

  SELECT COALESCE(nome, email, 'cliente') INTO v_quem
  FROM public.profiles WHERE id = auth.uid();

  UPDATE public.conteudos
  SET
    status = v_novo_status,
    feedback_cliente = CASE
      WHEN v_acao = 'aprovar' THEN NULL
      ELSE NULLIF(trim(COALESCE(_feedback, '')), '')
    END,
    historico = historico || jsonb_build_object(
      'evento', v_acao,
      'por', COALESCE(v_quem, 'cliente'),
      'em', now(),
      'texto', NULLIF(trim(COALESCE(_feedback, '')), '')
    ),
    atualizado_em = now()
  WHERE id = _id
    AND status = 'pendente_aprovacao'
    AND (public.has_role(auth.uid(), 'super_admin') OR cliente_id = public.current_cliente_id());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conteúdo não encontrado ou não está aguardando aprovação';
  END IF;
END $fn$;

-- ── 4. Bucket dos arquivos ──────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'criativos', 'criativos', false, 52428800,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/quicktime','application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Caminho dos arquivos: criativos/<cliente_id>/<conteudo_id>/<arquivo>
DROP POLICY IF EXISTS criativos_staff_all ON storage.objects;
CREATE POLICY criativos_staff_all ON storage.objects
  FOR ALL
  USING (bucket_id = 'criativos' AND public.is_staff(auth.uid()))
  WITH CHECK (bucket_id = 'criativos' AND public.is_staff(auth.uid()));

DROP POLICY IF EXISTS criativos_cliente_select ON storage.objects;
CREATE POLICY criativos_cliente_select ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'criativos'
    AND (storage.foldername(name))[1] = public.current_cliente_id()::text
  );
