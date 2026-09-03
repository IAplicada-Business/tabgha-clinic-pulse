-- Dados demonstrativos.
--
-- Decisões anti-duplicação:
--   * O seed é uma FUNÇÃO no banco, não um script .ts solto: roda a partir do
--     botão em /admin/configuracoes, é idempotente e fica versionada aqui.
--   * Uma coluna is_demo por tabela que recebe dados de demonstração — a
--     limpeza é um DELETE direto, sem tabela de rastreamento paralela.
--   * Os status do briefing (Novo Lead, Contato iniciado, Diagnóstico
--     agendado, Proposta enviada, Negociação, Cliente ativo, Pós-venda,
--     Cliente promotor) são o vocabulário do pipeline B2B. Como os cards são
--     pacientes do Dr. Pedro, entram em leads com o status equivalente do
--     funil de pacientes — nenhum status novo é criado:
--       Novo Lead → novo · Contato iniciado → em_conversa
--       Diagnóstico agendado → agendado · Proposta enviada / Negociação → interessado
--       Cliente ativo / Cliente promotor → convertido · Pós-venda → atendido
--   * whatsapp_conversations.origem é o ASSUNTO da conversa
--     (consulta/opme/duvida/retorno/indicacao/desconhecido), não o canal de
--     aquisição — o canal fica em leads.canal.

-- ── 1. Marca de demonstração ────────────────────────────────────────────────

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.conteudos ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.agendamentos ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.metricas_ads ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.faturas ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.diagnostico_respostas ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_demo ON public.leads (is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_conteudos_demo ON public.conteudos (is_demo) WHERE is_demo;
CREATE INDEX IF NOT EXISTS idx_metricas_demo ON public.metricas_ads (is_demo) WHERE is_demo;

COMMENT ON COLUMN public.leads.is_demo IS
  'Registro de demonstração. limpar_dados_demo() remove tudo que estiver marcado.';

-- ── 2. Limpeza ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.limpar_dados_demo()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  r jsonb := '{}'::jsonb;
  n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'apenas super admin' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.whatsapp_messages WHERE is_demo;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('mensagens', n);

  DELETE FROM public.whatsapp_conversations WHERE is_demo;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('conversas', n);

  DELETE FROM public.nurture_jobs
  WHERE lead_id IN (SELECT id FROM public.leads WHERE is_demo);
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('nurture_jobs', n);

  DELETE FROM public.automation_logs
  WHERE metadata ->> 'lead_id' IN (SELECT id::text FROM public.leads WHERE is_demo);

  DELETE FROM public.leads WHERE is_demo;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('leads', n);

  DELETE FROM public.conteudo_comentarios
  WHERE conteudo_id IN (SELECT id FROM public.conteudos WHERE is_demo);

  DELETE FROM public.conteudos WHERE is_demo;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('conteudos', n);

  DELETE FROM public.agendamentos WHERE is_demo;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('agendamentos', n);

  DELETE FROM public.metricas_ads WHERE is_demo;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('metricas', n);

  DELETE FROM public.faturas WHERE is_demo;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('faturas', n);

  DELETE FROM public.contratos WHERE is_demo;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('contratos', n);

  -- O diagnóstico demo apaga respostas, scores e relatório do mesmo cliente.
  DELETE FROM public.diagnostico_relatorios
  WHERE cliente_id IN (SELECT DISTINCT cliente_id FROM public.diagnostico_respostas WHERE is_demo);
  DELETE FROM public.diagnostico_scores
  WHERE cliente_id IN (SELECT DISTINCT cliente_id FROM public.diagnostico_respostas WHERE is_demo);
  DELETE FROM public.diagnostico_respostas WHERE is_demo;
  GET DIAGNOSTICS n = ROW_COUNT; r := r || jsonb_build_object('diagnostico_respostas', n);

  RETURN r;
END $fn$;

GRANT EXECUTE ON FUNCTION public.limpar_dados_demo() TO authenticated;

-- ── 3. Seed ─────────────────────────────────────────────────────────────────
-- Os leads são localizados por telefone depois do INSERT: a ordem de RETURNING
-- não é garantida pelo Postgres, então indexar por posição prenderia a conversa
-- no lead errado.

CREATE OR REPLACE FUNCTION public.seed_demo_tabgha(_cliente_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  hoje date := current_date;
  v_conv uuid;
  v_conteudo uuid;
  id_ana uuid; id_bruno uuid; id_carla uuid; id_daniel uuid; id_eliane uuid; id_joao uuid;
  i int;
  d date;
  gasto numeric;
  leads_dia int;
  total_leads int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'super_admin') THEN
    RAISE EXCEPTION 'apenas super admin' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = _cliente_id) THEN
    RAISE EXCEPTION 'cliente não encontrado';
  END IF;

  PERFORM public.limpar_dados_demo();

  -- ── 13 leads ──────────────────────────────────────────────────────────────
  INSERT INTO public.leads (cliente_id, nome, telefone, canal, status,
                            icp, observacoes, is_demo, criado_em, atualizado_em)
  SELECT _cliente_id, x.nome, x.telefone, x.canal, x.status, x.especialidade,
         x.obs, true, now() - (x.dias_atras || ' days')::interval,
         now() - (x.dias_atras || ' days')::interval
  FROM (VALUES
    ('[Demo] Ana Silva',     '5511981111001', 'meta',      'novo',        'Consulta geral', 'cidade: São Paulo | próximo follow: +2 dias', 1),
    ('[Demo] Bruno Costa',   '5511981111002', 'instagram', 'novo',        'Retorno',        'cidade: São Paulo | próximo follow: +1 dia', 1),
    ('[Demo] Carla Mendes',  '5519981111003', 'indicacao', 'em_conversa', 'Consulta geral', 'cidade: Campinas | ticket: 850 | próximo follow: +3 dias', 4),
    ('[Demo] Daniel Souza',  '5511981111004', 'meta',      'em_conversa', 'Exame',          'cidade: São Paulo | ticket: 1200 | próximo follow: +2 dias', 5),
    ('[Demo] Eliane Rocha',  '5521981111005', 'google',    'agendado',    'Consulta geral', 'cidade: Rio de Janeiro | ticket: 850 | reunião em +5 dias', 8),
    ('[Demo] Fábio Almeida', '5511981111006', 'whatsapp',  'agendado',    'Retorno',        'cidade: São Paulo | ticket: 450 | reunião em +2 dias', 7),
    ('[Demo] Giulia Bonet',  '5511981111007', 'meta',      'interessado', 'Consulta geral', 'cidade: São Paulo | ticket: 850 | proposta enviada | follow em +1 dia', 10),
    ('[Demo] Henrique Dias', '5519981111008', 'indicacao', 'interessado', 'Exame',          'cidade: Campinas | ticket: 1200 | proposta enviada | follow em +3 dias', 11),
    ('[Demo] Isabel Farias', '5511981111009', 'google',    'interessado', 'Consulta geral', 'cidade: São Paulo | ticket: 850 | em negociação | follow em +1 dia', 13),
    ('[Demo] João Pereira',  '5511981111010', 'instagram', 'convertido',  NULL,             'cidade: São Paulo | ticket: 850 | próxima em +30 dias', 20),
    ('[Demo] Karina Lima',   '5521981111011', 'meta',      'convertido',  NULL,             'cidade: Rio de Janeiro | ticket: 1200 | próxima em +45 dias', 24),
    ('[Demo] Larissa Melo',  '5511981111012', 'indicacao', 'atendido',    NULL,             'cidade: São Paulo | ticket: 850 | pós-venda | NPS enviado', 28),
    ('[Demo] Marcelo Nunes', '5519981111013', 'whatsapp',  'convertido',  NULL,             'cidade: Campinas | ticket: 2400 | cliente promotor | indicou 2 leads', 32)
  ) AS x(nome, telefone, canal, status, especialidade, obs, dias_atras);

  SELECT count(*) INTO total_leads FROM public.leads WHERE is_demo AND cliente_id = _cliente_id;

  SELECT id INTO id_ana    FROM public.leads WHERE is_demo AND cliente_id = _cliente_id AND telefone = '5511981111001';
  SELECT id INTO id_bruno  FROM public.leads WHERE is_demo AND cliente_id = _cliente_id AND telefone = '5511981111002';
  SELECT id INTO id_carla  FROM public.leads WHERE is_demo AND cliente_id = _cliente_id AND telefone = '5519981111003';
  SELECT id INTO id_daniel FROM public.leads WHERE is_demo AND cliente_id = _cliente_id AND telefone = '5511981111004';
  SELECT id INTO id_eliane FROM public.leads WHERE is_demo AND cliente_id = _cliente_id AND telefone = '5521981111005';
  SELECT id INTO id_joao   FROM public.leads WHERE is_demo AND cliente_id = _cliente_id AND telefone = '5511981111010';

  -- ── Thread 1 · Ana Silva · IA em andamento (4 mensagens) ─────────────────
  INSERT INTO public.whatsapp_conversations
    (cliente_id, lead_id, contact_phone, contact_name, origem, state, owner_state,
     bot_score, bot_notes, step_count, last_inbound_at, last_outbound_at, is_demo)
  VALUES (_cliente_id, id_ana, '5511981111001', '[Demo] Ana Silva', 'consulta',
          'qualifying', 'bot', 62,
          jsonb_build_object('resumo', 'Interessada em consulta geral; mora perto da clínica.',
                             'fonte_tocada', 'aquisicao_pacientes',
                             'maturidade_percebida', 'media'),
          4, now() - interval '3 hours', now() - interval '3 hours', true)
  RETURNING id INTO v_conv;

  INSERT INTO public.whatsapp_messages (conversation_id, cliente_id, direction, sender_type, body, sent_at, is_demo)
  VALUES
    (v_conv, _cliente_id, 'inbound',  'human', 'Oi, vi o anúncio de vocês', now() - interval '5 hours', true),
    (v_conv, _cliente_id, 'outbound', 'bot',   'Olá! Que bom te ver por aqui. Sou o assistente da clínica. Você procura consulta, retorno ou exame?', now() - interval '5 hours' + interval '1 minute', true),
    (v_conv, _cliente_id, 'inbound',  'human', 'Consulta geral mesmo', now() - interval '3 hours', true),
    (v_conv, _cliente_id, 'outbound', 'bot',   'Perfeito. Para eu te indicar o melhor caminho: hoje você já acompanha com algum profissional ou seria a primeira consulta?', now() - interval '3 hours' + interval '1 minute', true);

  -- ── Thread 2 · Bruno Costa · passagem para humano (6 mensagens) ──────────
  INSERT INTO public.whatsapp_conversations
    (cliente_id, lead_id, contact_phone, contact_name, origem, state, owner_state,
     bot_score, bot_notes, step_count, last_inbound_at, last_outbound_at, is_demo)
  VALUES (_cliente_id, id_bruno, '5511981111002', '[Demo] Bruno Costa', 'retorno',
          'handoff', 'human_active', 88,
          jsonb_build_object('resumo', 'Falou "urgente" — passou para humano no 3º turno.',
                             'passou_para_humano', true, 'agendamento_sugerido', true),
          6, now() - interval '1 day', now() - interval '1 day' + interval '20 minutes', true)
  RETURNING id INTO v_conv;

  INSERT INTO public.whatsapp_messages (conversation_id, cliente_id, direction, sender_type, body, sent_at, is_demo)
  VALUES
    (v_conv, _cliente_id, 'inbound',  'human', 'Boa tarde, preciso de um retorno', now() - interval '1 day' - interval '30 minutes', true),
    (v_conv, _cliente_id, 'outbound', 'bot',   'Boa tarde! Claro. Você já foi atendido aqui antes?', now() - interval '1 day' - interval '29 minutes', true),
    (v_conv, _cliente_id, 'inbound',  'human', 'Sim, mas é urgente, estou com dor forte', now() - interval '1 day' - interval '20 minutes', true),
    (v_conv, _cliente_id, 'outbound', 'bot',   'Entendi. Vou chamar alguém da equipe agora para te atender.', now() - interval '1 day' - interval '19 minutes', true),
    (v_conv, _cliente_id, 'outbound', 'human', 'Bruno, aqui é a Camila da recepção. Consigo te encaixar amanhã às 9h, pode ser?', now() - interval '1 day' - interval '10 minutes', true),
    (v_conv, _cliente_id, 'inbound',  'human', 'Pode sim, muito obrigado', now() - interval '1 day', true);

  -- ── Thread 3 · Carla Mendes · conversão (12 mensagens) ───────────────────
  INSERT INTO public.whatsapp_conversations
    (cliente_id, lead_id, contact_phone, contact_name, origem, state, owner_state,
     bot_score, bot_notes, step_count, last_inbound_at, last_outbound_at, closed_at, closed_reason, is_demo)
  VALUES (_cliente_id, id_carla, '5519981111003', '[Demo] Carla Mendes', 'indicacao',
          'agendado', 'bot', 91,
          jsonb_build_object('resumo', 'Conduzida do primeiro contato até o agendamento do Diagnóstico.',
                             'fonte_tocada', 'conversao', 'agendamento_sugerido', true,
                             'maturidade_percebida', 'alta'),
          12, now() - interval '2 days', now() - interval '2 days' + interval '5 minutes',
          now() - interval '2 days' + interval '10 minutes', 'agendado', true)
  RETURNING id INTO v_conv;

  INSERT INTO public.whatsapp_messages (conversation_id, cliente_id, direction, sender_type, body, sent_at, is_demo)
  SELECT v_conv, _cliente_id, x.dir, x.tipo, x.corpo, now() - interval '4 days' + (x.ordem || ' hours')::interval, true
  FROM (VALUES
    ('inbound','human','Oi! Uma amiga me indicou a clínica',1),
    ('outbound','bot','Olá, Carla! Que bom receber indicação. Me conta: o que te trouxe até aqui?',2),
    ('inbound','human','Queria entender se vale a pena marcar uma consulta',3),
    ('outbound','bot','Faz sentido avaliar antes. Você está buscando por um sintoma específico ou é acompanhamento?',4),
    ('inbound','human','Acompanhamento mesmo, faz uns 2 anos que não vou',5),
    ('outbound','bot','Entendi. Dois anos é um intervalo em que vale revisar o quadro completo.',6),
    ('inbound','human','E como funciona a primeira consulta?',7),
    ('outbound','bot','A primeira consulta é uma avaliação completa: histórico, exame e um plano de acompanhamento.',8),
    ('inbound','human','Legal. Consigo marcar para semana que vem?',9),
    ('outbound','bot','Consigo sim. Tenho terça às 14h ou quinta às 10h. Qual fica melhor?',10),
    ('inbound','human','Quinta às 10h',11),
    ('outbound','bot','Agendado para quinta às 10h. Vou te mandar a confirmação e o endereço por aqui.',12)
  ) AS x(dir, tipo, corpo, ordem);

  -- ── Thread 4 · Daniel Souza · objeção resolvida (8 mensagens) ────────────
  INSERT INTO public.whatsapp_conversations
    (cliente_id, lead_id, contact_phone, contact_name, origem, state, owner_state,
     bot_score, bot_notes, step_count, last_inbound_at, last_outbound_at, is_demo)
  VALUES (_cliente_id, id_daniel, '5511981111004', '[Demo] Daniel Souza', 'duvida',
          'qualifying', 'bot', 74,
          jsonb_build_object('resumo', 'Objeção de preço tratada; redirecionado para avaliação.',
                             'fonte_tocada', 'conversao', 'maturidade_percebida', 'media'),
          8, now() - interval '1 day', now() - interval '1 day' + interval '2 minutes', true)
  RETURNING id INTO v_conv;

  INSERT INTO public.whatsapp_messages (conversation_id, cliente_id, direction, sender_type, body, sent_at, is_demo)
  SELECT v_conv, _cliente_id, x.dir, x.tipo, x.corpo, now() - interval '2 days' + (x.ordem || ' hours')::interval, true
  FROM (VALUES
    ('inbound','human','Quanto custa o exame?',1),
    ('outbound','bot','Depende do que for indicado na avaliação. Posso te explicar como funciona?',2),
    ('inbound','human','Pode',3),
    ('outbound','bot','O médico avalia primeiro e só pede o que for necessário — assim você não paga por exame que não precisa.',4),
    ('inbound','human','Mas a avaliação já tem custo né',5),
    ('outbound','bot','Tem, e é o mesmo valor da consulta. A diferença é sair de lá com um plano, e não com uma lista de exames.',6),
    ('inbound','human','Faz sentido. Como marco?',7),
    ('outbound','bot','Me diz dois horários que funcionam para você nesta semana que eu já reservo.',8)
  ) AS x(dir, tipo, corpo, ordem);

  -- ── Thread 5 · Eliane Rocha · nutrição ativa (3 mensagens) ───────────────
  INSERT INTO public.whatsapp_conversations
    (cliente_id, lead_id, contact_phone, contact_name, origem, state, owner_state,
     bot_score, bot_notes, step_count, last_inbound_at, last_outbound_at, is_demo)
  VALUES (_cliente_id, id_eliane, '5521981111005', '[Demo] Eliane Rocha', 'consulta',
          'qualifying', 'bot', 55,
          jsonb_build_object('resumo', 'Sequência B em andamento: mensagem do dia 3 enviada.'),
          3, now() - interval '6 days', now() - interval '3 days', true)
  RETURNING id INTO v_conv;

  INSERT INTO public.whatsapp_messages (conversation_id, cliente_id, direction, sender_type, body, sent_at, is_demo)
  VALUES
    (v_conv, _cliente_id, 'inbound',  'human', 'Boa tarde, queria informações', now() - interval '6 days', true),
    (v_conv, _cliente_id, 'outbound', 'bot',   'Boa tarde! Claro. Você procura consulta, retorno ou exame?', now() - interval '6 days' + interval '1 minute', true),
    (v_conv, _cliente_id, 'outbound', 'bot',   E'Olá, Eliane.\nVi que nossa conversa ficou aberta e queria ter certeza de que você recebeu as informações que precisava.\nTem algo específico que posso esclarecer? Estou por aqui.', now() - interval '3 days', true);

  INSERT INTO public.nurture_jobs (cliente_id, lead_id, kind, step, status, next_run_at, last_sent_at, metadata, enviadas)
  VALUES (_cliente_id, id_eliane, 'seq_b', 1, 'pending',
          now() + interval '1 day', now() - interval '3 days',
          jsonb_build_object('gatilho_em', (now() - interval '6 days')::text, 'motivo', 'demo'),
          jsonb_build_array(jsonb_build_object('mensagem', 1, 'dia', 3, 'enviada_em', (now() - interval '3 days')::text)));

  -- ── Thread 6 · João Pereira · pós-venda (2 mensagens) ────────────────────
  INSERT INTO public.whatsapp_conversations
    (cliente_id, lead_id, contact_phone, contact_name, origem, state, owner_state,
     bot_score, bot_notes, step_count, last_inbound_at, last_outbound_at, is_demo)
  VALUES (_cliente_id, id_joao, '5511981111010', '[Demo] João Pereira', 'retorno',
          'closed', 'closed', 40,
          jsonb_build_object('resumo', 'Sequência C: pedido de avaliação no Google respondido.'),
          2, now() - interval '9 days', now() - interval '10 days', true)
  RETURNING id INTO v_conv;

  INSERT INTO public.whatsapp_messages (conversation_id, cliente_id, direction, sender_type, body, sent_at, is_demo)
  VALUES
    (v_conv, _cliente_id, 'outbound', 'bot', E'Olá, João. Espero que a consulta tenha atendido suas expectativas.\nSe puder compartilhar sua experiência em uma avaliação no Google, você ajuda outras pessoas a encontrarem um atendimento de confiança.\nLeva 30 segundos. Obrigado desde já.', now() - interval '10 days', true),
    (v_conv, _cliente_id, 'inbound', 'human', 'Já avaliei! Atendimento excelente, obrigado', now() - interval '9 days', true);

  -- ── 5 conteúdos ──────────────────────────────────────────────────────────
  INSERT INTO public.conteudos (cliente_id, titulo, roteiro, legenda, pilar, formato, status,
                                data_sugerida, tags, versao, historico, feedback_cliente, is_demo)
  VALUES
    (_cliente_id, '[Demo] 5 sinais de que sua clínica precisa de estratégia digital',
     'Carrossel de 8 slides destrinchando os sinais.', 'Sua agenda está cheia, mas os retornos caíram? Deslize e veja os 5 sinais.',
     'autoridade', 'carrossel', 'pendente_aprovacao', hoje + 3, ARRAY['carrossel','autoridade'], 1,
     jsonb_build_array(jsonb_build_object('evento','criado','por','equipe Tabgha','em', now() - interval '2 days'),
                       jsonb_build_object('evento','enviado_aprovacao','por','equipe Tabgha','em', now() - interval '1 day')), NULL, true),
    (_cliente_id, '[Demo] Dr. Pedro responde as 3 dúvidas mais comuns',
     'Vídeo curto de 45s, corte vertical.', 'As 3 perguntas que mais chegam no consultório — respondidas em 45 segundos.',
     'relacionamento', 'video', 'pendente_aprovacao', hoje + 5, ARRAY['reels','relacionamento'], 1,
     jsonb_build_array(jsonb_build_object('evento','criado','por','equipe Tabgha','em', now() - interval '2 days'),
                       jsonb_build_object('evento','enviado_aprovacao','por','equipe Tabgha','em', now() - interval '1 day')), NULL, true),
    (_cliente_id, '[Demo] Agende sua consulta esta semana',
     'Post estático com CTA direto.', 'Agenda aberta para esta semana. Link na bio.',
     'conversao', 'imagem', 'aprovado', hoje + 1, ARRAY['conversao','cta'], 1,
     jsonb_build_array(jsonb_build_object('evento','criado','por','equipe Tabgha','em', now() - interval '5 days'),
                       jsonb_build_object('evento','enviado_aprovacao','por','equipe Tabgha','em', now() - interval '4 days'),
                       jsonb_build_object('evento','aprovar','por','Dr. Pedro Correa','em', now() - interval '3 days')), NULL, true),
    (_cliente_id, '[Demo] Depoimento paciente Ana',
     'Story com depoimento em vídeo.', 'O que a Ana falou depois da consulta.',
     'reputacao', 'story', 'pedir_ajuste', hoje + 2, ARRAY['story','reputacao'], 1,
     jsonb_build_array(jsonb_build_object('evento','criado','por','equipe Tabgha','em', now() - interval '4 days'),
                       jsonb_build_object('evento','enviado_aprovacao','por','equipe Tabgha','em', now() - interval '3 days'),
                       jsonb_build_object('evento','pedir_ajuste','por','Dr. Pedro Correa','em', now() - interval '2 days','texto','trocar a foto de fundo')),
     'trocar a foto de fundo', true),
    (_cliente_id, '[Demo] Guia completo sobre Ortopedia',
     'Texto longo para o blog, ainda em rascunho.', NULL,
     'autoridade', 'texto', 'rascunho', NULL, ARRAY['blog','autoridade'], 1,
     jsonb_build_array(jsonb_build_object('evento','criado','por','equipe Tabgha','em', now() - interval '1 day')), NULL, true);

  SELECT id INTO v_conteudo FROM public.conteudos
  WHERE is_demo AND cliente_id = _cliente_id AND status = 'pedir_ajuste' LIMIT 1;
  IF v_conteudo IS NOT NULL THEN
    INSERT INTO public.conteudo_comentarios (conteudo_id, autor_nome, autor_lado, texto, criado_em)
    VALUES (v_conteudo, 'Dr. Pedro Correa', 'cliente', 'Trocar a foto de fundo, ficou escura demais.', now() - interval '2 days');
  END IF;

  -- ── 3 eventos de calendário ──────────────────────────────────────────────
  INSERT INTO public.agendamentos (cliente_id, titulo, descricao, tipo, inicio, fim, visivel_cliente, is_demo)
  VALUES
    (_cliente_id, '[Demo] Reunião mensal de resultado', 'Leitura do mês com o Dr. Pedro.', 'reuniao',
     (hoje + 5)::timestamptz + time '10:00', (hoje + 5)::timestamptz + time '11:00', true, true),
    (_cliente_id, '[Demo] Sessão de gravação de conteúdo', 'Gravação dos reels do mês.', 'gravacao',
     (hoje + 12)::timestamptz + time '14:00', (hoje + 12)::timestamptz + time '17:00', true, true),
    (_cliente_id, '[Demo] Reunião com potencial parceria (Dra. Beatriz)', 'Conversa inicial de parceria.', 'reuniao',
     (hoje + 20)::timestamptz + time '09:00', (hoje + 20)::timestamptz + time '10:00', false, true);

  -- ── Métricas Meta dos últimos 30 dias ────────────────────────────────────
  -- Curva com queda de fim de semana; o ajuste no fim fecha em R$ 4.000 e 47 leads.
  FOR i IN 0..29 LOOP
    d := hoje - i;
    gasto := CASE WHEN EXTRACT(dow FROM d) IN (0, 6) THEN 95 ELSE 148 END;
    leads_dia := CASE WHEN EXTRACT(dow FROM d) IN (0, 6) THEN 1 ELSE 2 END;

    INSERT INTO public.metricas_ads
      (cliente_id, plataforma, data, nivel, campanha, anuncio, ad_id,
       investimento, impressoes, cliques, leads, conversoes, cpl, cpa, roas, is_demo)
    VALUES (_cliente_id, 'meta', d, 'campanha',
            '[Demo] Captação · Ortopedia', '[Demo] Vídeo institucional', 'demo-ad-1',
            gasto, (gasto * 62)::int, (gasto * 1.4)::int, leads_dia,
            CASE WHEN i % 3 = 0 THEN 1 ELSE 0 END,
            ROUND(gasto / GREATEST(leads_dia, 1), 2),
            CASE WHEN i % 3 = 0 THEN ROUND(gasto, 2) ELSE NULL END,
            1.91, true);
  END LOOP;

  UPDATE public.metricas_ads SET investimento = investimento +
    (4000 - (SELECT SUM(investimento) FROM public.metricas_ads WHERE is_demo AND cliente_id = _cliente_id))
  WHERE is_demo AND cliente_id = _cliente_id AND data = hoje;

  UPDATE public.metricas_ads SET leads = leads +
    (47 - (SELECT SUM(leads) FROM public.metricas_ads WHERE is_demo AND cliente_id = _cliente_id))
  WHERE is_demo AND cliente_id = _cliente_id AND data = hoje;

  UPDATE public.metricas_ads
  SET cpl = ROUND(investimento / GREATEST(leads, 1), 2)
  WHERE is_demo AND cliente_id = _cliente_id AND leads > 0;

  -- ── Diagnóstico 7 Fontes ─────────────────────────────────────────────────
  INSERT INTO public.diagnostico_respostas (cliente_id, questao_id, valor_num, is_demo)
  SELECT _cliente_id, q.id,
    CASE q.fonte
      WHEN 'posicionamento'       THEN 75
      WHEN 'presenca_digital'     THEN 75
      WHEN 'aquisicao_pacientes'  THEN 50
      WHEN 'conversao'            THEN 50
      WHEN 'experiencia_paciente' THEN 75
      WHEN 'inteligencia_dados'   THEN 25
      ELSE 75
    END,
    true
  FROM public.diagnostico_questoes q
  WHERE q.ativa
  ON CONFLICT (cliente_id, questao_id) DO UPDATE
    SET valor_num = EXCLUDED.valor_num, is_demo = true, atualizado_em = now();

  PERFORM public.recalcular_diagnostico_score(_cliente_id, f)
  FROM unnest(ARRAY['posicionamento','presenca_digital','aquisicao_pacientes','conversao',
                    'experiencia_paciente','inteligencia_dados','escala']::public.fonte_diagnostico[]) AS f;

  -- Ajusta para as notas exatas do briefing (geral 58).
  UPDATE public.diagnostico_scores SET score = v.nota, atualizado_em = now()
  FROM (VALUES
    ('posicionamento', 72), ('presenca_digital', 65), ('aquisicao_pacientes', 45),
    ('conversao', 50), ('experiencia_paciente', 70), ('inteligencia_dados', 40), ('escala', 65)
  ) AS v(fonte, nota)
  WHERE diagnostico_scores.cliente_id = _cliente_id
    AND diagnostico_scores.fonte = v.fonte::public.fonte_diagnostico;

  RETURN jsonb_build_object(
    'leads', total_leads,
    'conversas', 6,
    'conteudos', 5,
    'agendamentos', 3,
    'dias_de_metricas', 30,
    'diagnostico', 'nota geral 58 · prioridades F6, F3 e F4'
  );
END $fn$;

GRANT EXECUTE ON FUNCTION public.seed_demo_tabgha(uuid) TO authenticated;
