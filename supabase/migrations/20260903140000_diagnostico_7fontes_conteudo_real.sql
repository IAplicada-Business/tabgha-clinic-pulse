-- Diagnóstico 7 Fontes · conteúdo real + escala Likert 0-100
--
-- Substitui o questionário provisório (placeholder) pelas 35 perguntas oficiais
-- e troca a régua de 1-5 para a Likert de 5 opções valendo 0/25/50/75/100.
--
-- As perguntas são atualizadas POR CÓDIGO (pos_01…esc_05), então os ids e as FKs
-- ficam estáveis. As respostas anteriores são apagadas de propósito: foram dadas
-- a perguntas provisórias que deixam de existir e numa escala diferente —
-- mantê-las produziria um score enganoso. Só havia respostas do cliente interno
-- Tabgha (35 respostas, 7 scores, 1 relatório).

-- ── 1. Limpa o que era do questionário provisório ────────────────────────────
-- Ordem importa: respostas primeiro (o trigger recalcula scores), depois o resto.
DELETE FROM public.diagnostico_respostas;
DELETE FROM public.diagnostico_scores;
DELETE FROM public.diagnostico_relatorios;

-- ── 2. Escala: 1-5 → Likert 0-100 ────────────────────────────────────────────
ALTER TABLE public.diagnostico_respostas
  DROP CONSTRAINT IF EXISTS diagnostico_respostas_valor_check;

ALTER TABLE public.diagnostico_respostas
  ADD CONSTRAINT diagnostico_respostas_valor_check
  CHECK (valor_num IS NULL OR valor_num IN (0, 25, 50, 75, 100));

COMMENT ON COLUMN public.diagnostico_respostas.valor_num IS
  'Likert de 5 opções: 0 Discordo totalmente · 25 Discordo · 50 Neutro · 75 Concordo · 100 Concordo totalmente.';

-- Novo tipo de questão (mantém sim_nao/texto para outros usos futuros).
ALTER TABLE public.diagnostico_questoes
  DROP CONSTRAINT IF EXISTS diagnostico_questoes_tipo_check;

ALTER TABLE public.diagnostico_questoes
  ADD CONSTRAINT diagnostico_questoes_tipo_check
  CHECK (tipo = ANY (ARRAY['likert_0_100'::text, 'escala_1_5'::text, 'sim_nao'::text, 'texto'::text]));

-- ── 3. Score: média ponderada direta (o valor já é 0-100) ────────────────────
-- Antes dividia por (SUM(peso) * 5) porque a resposta ia de 1 a 5.
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
          / SUM(q.peso) FILTER (WHERE r.valor_num IS NOT NULL),
          2
        )
      ELSE NULL
    END
    INTO _respondidas, _score
  FROM public.diagnostico_respostas r
  JOIN public.diagnostico_questoes q ON q.id = r.questao_id
  WHERE r.cliente_id = _cliente_id
    AND q.fonte = _fonte
    AND q.ativa
    AND q.tipo <> 'texto';

  INSERT INTO public.diagnostico_scores (cliente_id, fonte, score, respondidas, total, atualizado_em)
  VALUES (_cliente_id, _fonte, _score, COALESCE(_respondidas, 0), COALESCE(_total, 0), now())
  ON CONFLICT (cliente_id, fonte) DO UPDATE
    SET score        = EXCLUDED.score,
        respondidas  = EXCLUDED.respondidas,
        total        = EXCLUDED.total,
        atualizado_em = now();
END;
$$;

-- ── 4. As 35 perguntas oficiais ──────────────────────────────────────────────
UPDATE public.diagnostico_questoes q
SET pergunta = v.pergunta,
    ajuda = NULL,
    tipo = 'likert_0_100',
    peso = 1,
    placeholder = false,
    ativa = true
FROM (VALUES
  -- Fonte 1 · Posicionamento
  ('pos_01', 'Tenho um posicionamento claro que me diferencia dos concorrentes da minha especialidade na minha cidade.'),
  ('pos_02', 'Sei descrever em uma frase qual é minha proposta de valor única para o paciente ideal.'),
  ('pos_03', 'Minha comunicação (site, redes, WhatsApp) reflete consistentemente esse posicionamento.'),
  ('pos_04', 'Tenho autoridade digital reconhecida na minha especialidade (menções, entrevistas, artigos).'),
  ('pos_05', 'Meu paciente ideal está bem definido em termos de perfil, dor e capacidade financeira.'),
  -- Fonte 2 · Presença Digital
  ('dig_01', 'Meu site é otimizado, carrega rápido e converte visitante em contato.'),
  ('dig_02', 'Meu Google Perfil da Empresa está completo, com avaliações recentes e respondidas.'),
  ('dig_03', 'Publico conteúdo profissional consistente nas redes sociais (mínimo 3x/semana).'),
  ('dig_04', 'Apareço nas primeiras posições do Google quando buscam minha especialidade + minha cidade.'),
  ('dig_05', 'Tenho estratégia clara de SEO e presença orgânica de médio prazo.'),
  -- Fonte 3 · Aquisição de Pacientes
  ('aqu_01', 'Tenho campanhas ativas de Meta Ads ou Google Ads gerando leads previsíveis todo mês.'),
  ('aqu_02', 'Sei exatamente meu Custo por Lead (CPL) de cada fonte de aquisição.'),
  ('aqu_03', 'Tenho landing pages otimizadas para meus principais serviços.'),
  ('aqu_04', 'Meu funil de aquisição está mapeado e integrado a um CRM.'),
  ('aqu_05', 'Sei quantos leads preciso gerar para converter um paciente novo.'),
  -- Fonte 4 · Conversão
  ('con_01', 'Meu WhatsApp responde leads em menos de 5 minutos no horário comercial.'),
  ('con_02', 'Tenho scripts padronizados de atendimento para diferentes objeções.'),
  ('con_03', 'Minha secretaria/atendimento é treinada em técnicas de agendamento consultivo.'),
  ('con_04', 'Meço a taxa de conversão de lead em consulta agendada.'),
  ('con_05', 'Uso automação ou IA para atender fora do horário comercial.'),
  -- Fonte 5 · Experiência do Paciente
  ('exp_01', 'Tenho jornada mapeada do paciente do primeiro contato até o pós-consulta.'),
  ('exp_02', 'Coleto NPS ou avaliação de cada paciente atendido.'),
  ('exp_03', 'Tenho processo ativo de coleta de avaliações no Google e outras plataformas.'),
  ('exp_04', 'Tenho programa de fidelização ou retorno de pacientes.'),
  ('exp_05', 'Tenho processo estruturado de indicação de pacientes atuais.'),
  -- Fonte 6 · Inteligência de Dados
  ('dad_01', 'Acompanho semanalmente meus principais KPIs (CAC, CPL, ROI, LTV).'),
  ('dad_02', 'Sei o faturamento por serviço e por médico da clínica.'),
  ('dad_03', 'Uso dashboard ou ferramenta para visualizar dados em tempo real.'),
  ('dad_04', 'Tomo decisões estratégicas baseadas em dados, não em intuição.'),
  ('dad_05', 'Consigo prever com precisão razoável meu faturamento dos próximos 90 dias.'),
  -- Fonte 7 · Escala
  ('esc_01', 'Tenho processos operacionais documentados e replicáveis.'),
  ('esc_02', 'Uso automação em pelo menos 3 processos-chave da clínica.'),
  ('esc_03', 'Uso IA em pelo menos 1 processo-chave (atendimento, marketing, análise).'),
  ('esc_04', 'Meu compliance médico (CFM, LGPD) está estruturado e auditável.'),
  ('esc_05', 'Consigo abrir uma nova unidade ou dobrar volume sem multiplicar meu tempo pessoal.')
) AS v(codigo, pergunta)
WHERE q.codigo = v.codigo;

-- ── 5. Frases diagnósticas por faixa ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.diagnostico_frases_por_faixa (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fonte       public.fonte_diagnostico NOT NULL,
  faixa_min   smallint NOT NULL,
  faixa_max   smallint NOT NULL,
  frase       text NOT NULL,
  -- true = texto de trabalho, pendente de redação final pelo time IAplicada
  placeholder boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT diagnostico_frases_faixa_unica UNIQUE (fonte, faixa_min),
  CONSTRAINT diagnostico_frases_faixa_valida CHECK (faixa_min >= 0 AND faixa_max <= 100 AND faixa_min <= faixa_max)
);

COMMENT ON TABLE public.diagnostico_frases_por_faixa IS
  'Frase diagnóstica mostrada no card de cada Fonte, escolhida pela faixa do score (0-40, 41-70, 71-100). placeholder=true → rascunho no molde, pendente de redação final.';

ALTER TABLE public.diagnostico_frases_por_faixa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS diag_frases_leitura ON public.diagnostico_frases_por_faixa;
CREATE POLICY diag_frases_leitura ON public.diagnostico_frases_por_faixa
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS diag_frases_admin ON public.diagnostico_frases_por_faixa;
CREATE POLICY diag_frases_admin ON public.diagnostico_frases_por_faixa
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fonte 1 vem redigida na especificação (placeholder = false).
-- As outras 18 são rascunhos no mesmo molde — diagnóstico do que trava +
-- alavanca — para a tela não nascer vazia; o time IAplicada substitui o texto.
INSERT INTO public.diagnostico_frases_por_faixa (fonte, faixa_min, faixa_max, frase, placeholder)
VALUES
  ('posicionamento', 0, 40, 'Seu posicionamento ainda não está claro. Sem diferenciação, cada campanha compete por preço. Estruturar aqui é a alavanca de maior impacto.', false),
  ('posicionamento', 41, 70, 'Você tem posicionamento definido, mas ainda inconsistente entre canais. Padronizar a mensagem multiplica reconhecimento.', false),
  ('posicionamento', 71, 100, 'Posicionamento sólido. Próximo nível é ampliar autoridade digital com produção de conteúdo especializado.', false),

  ('presenca_digital', 0, 40, 'Sua presença digital ainda não sustenta a busca do paciente. Quem procura sua especialidade hoje encontra os concorrentes. Site e Google Perfil são o primeiro passo.', true),
  ('presenca_digital', 41, 70, 'Você já é encontrado, mas de forma irregular. Constância de publicação e SEO local transformam presença em fluxo previsível.', true),
  ('presenca_digital', 71, 100, 'Presença digital consistente. O próximo nível é converter alcance em autoridade — conteúdo aprofundado e reputação ativa.', true),

  ('aquisicao_pacientes', 0, 40, 'A entrada de pacientes depende de indicação e acaso. Sem campanha nem CPL conhecido, não há previsibilidade de agenda.', true),
  ('aquisicao_pacientes', 41, 70, 'Você já gera demanda, mas sem controle fino de custo e volume. Integrar funil e CRM revela onde o investimento rende.', true),
  ('aquisicao_pacientes', 71, 100, 'Aquisição madura e mensurável. O próximo nível é escalar investimento mantendo o CPL sob controle.', true),

  ('conversao', 0, 40, 'Lead gerado está se perdendo antes de virar consulta. Tempo de resposta e ausência de script são o gargalo mais caro da operação.', true),
  ('conversao', 41, 70, 'Sua conversão funciona, mas depende de quem atende. Padronizar objeções e medir a taxa tira o resultado da sorte.', true),
  ('conversao', 71, 100, 'Conversão estruturada. O próximo nível é automação e IA para não perder contato fora do horário comercial.', true),

  ('experiencia_paciente', 0, 40, 'A jornada do paciente termina na consulta. Sem pós-atendimento nem avaliação, cada paciente novo custa o preço cheio.', true),
  ('experiencia_paciente', 41, 70, 'Existe cuidado com a experiência, mas ele não é sistemático. Formalizar NPS e coleta de avaliações gera reputação composta.', true),
  ('experiencia_paciente', 71, 100, 'Experiência bem cuidada. O próximo nível é transformar satisfação em indicação estruturada e recorrência.', true),

  ('inteligencia_dados', 0, 40, 'As decisões são tomadas por intuição. Sem KPIs acompanhados, não dá para saber o que está funcionando nem prever faturamento.', true),
  ('inteligencia_dados', 41, 70, 'Você olha números, mas de forma esparsa. Centralizar os indicadores num painel único encurta o ciclo de decisão.', true),
  ('inteligencia_dados', 71, 100, 'Operação orientada a dados. O próximo nível é previsibilidade — projetar faturamento e antecipar variação de demanda.', true),

  ('escala', 0, 40, 'A clínica depende do seu tempo pessoal. Sem processo documentado, crescer significa trabalhar mais, não faturar mais.', true),
  ('escala', 41, 70, 'Há processos, mas ainda com dependência do sócio principal. Automatizar o que se repete libera capacidade real.', true),
  ('escala', 71, 100, 'Operação preparada para escalar. O próximo nível é replicar o modelo em nova unidade ou novo serviço.', true)
ON CONFLICT (fonte, faixa_min) DO NOTHING;
