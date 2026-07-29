-- Etapa 2 / Fase C — Seed do questionário das 7 Fontes.
--
-- PLACEHOLDER — revisar com Pietro (Etapa 4).
-- Todas as linhas entram com placeholder = true. São 5 perguntas genéricas por
-- Fonte, escritas para exercitar o fluxo (wizard + trigger de score); NÃO são o
-- questionário oficial do Blueprint. Ao receber o questionário real, desative
-- estas questões (ativa = false) em vez de apagá-las, para não perder as
-- respostas já coletadas.

INSERT INTO public.diagnostico_questoes
  (codigo, fonte, ordem, pergunta, tipo, peso, placeholder, ativa)
VALUES
  -- Fonte 1 — Posicionamento
  ('pos_01', 'posicionamento', 1, 'A clínica tem um posicionamento claro que a diferencia dos concorrentes da região?', 'escala_1_5', 1, true, true),
  ('pos_02', 'posicionamento', 2, 'O público-alvo prioritário está definido e documentado?', 'escala_1_5', 1, true, true),
  ('pos_03', 'posicionamento', 3, 'A proposta de valor é comunicada de forma consistente em todos os canais?', 'escala_1_5', 1, true, true),
  ('pos_04', 'posicionamento', 4, 'Os preços e pacotes estão alinhados ao posicionamento pretendido?', 'escala_1_5', 1, true, true),
  ('pos_05', 'posicionamento', 5, 'A marca é reconhecida pelo público que você quer atingir?', 'escala_1_5', 1, true, true),

  -- Fonte 2 — Presença Digital
  ('dig_01', 'presenca_digital', 1, 'Os perfis nas redes sociais estão atualizados e com identidade visual consistente?', 'escala_1_5', 1, true, true),
  ('dig_02', 'presenca_digital', 2, 'Existe publicação de conteúdo com frequência previsível?', 'escala_1_5', 1, true, true),
  ('dig_03', 'presenca_digital', 3, 'O site ou landing page apresenta com clareza os serviços e as formas de contato?', 'escala_1_5', 1, true, true),
  ('dig_04', 'presenca_digital', 4, 'O perfil no Google Meu Negócio está completo e com avaliações recentes?', 'escala_1_5', 1, true, true),
  ('dig_05', 'presenca_digital', 5, 'A produção de conteúdo segue um planejamento, e não improviso?', 'escala_1_5', 1, true, true),

  -- Fonte 3 — Aquisição de Pacientes
  ('aqu_01', 'aquisicao_pacientes', 1, 'Existem canais de aquisição ativos e mensuráveis (tráfego pago, indicação, orgânico)?', 'escala_1_5', 1, true, true),
  ('aqu_02', 'aquisicao_pacientes', 2, 'O custo de aquisição por paciente é conhecido?', 'escala_1_5', 1, true, true),
  ('aqu_03', 'aquisicao_pacientes', 3, 'O volume de novos contatos por mês é suficiente para a meta da clínica?', 'escala_1_5', 1, true, true),
  ('aqu_04', 'aquisicao_pacientes', 4, 'As campanhas têm segmentação definida por especialidade ou procedimento?', 'escala_1_5', 1, true, true),
  ('aqu_05', 'aquisicao_pacientes', 5, 'A origem de cada lead é registrada de forma confiável?', 'escala_1_5', 1, true, true),

  -- Fonte 4 — Conversão
  ('con_01', 'conversao', 1, 'O tempo de primeira resposta a um novo contato é inferior a 15 minutos?', 'escala_1_5', 1, true, true),
  ('con_02', 'conversao', 2, 'Existe roteiro de atendimento para qualificação do paciente?', 'escala_1_5', 1, true, true),
  ('con_03', 'conversao', 3, 'As objeções mais comuns têm respostas padronizadas?', 'escala_1_5', 1, true, true),
  ('con_04', 'conversao', 4, 'A taxa de conversão de contato em consulta agendada é acompanhada?', 'escala_1_5', 1, true, true),
  ('con_05', 'conversao', 5, 'Há follow-up estruturado para quem não fecha na primeira conversa?', 'escala_1_5', 1, true, true),

  -- Fonte 5 — Experiência do Paciente
  ('exp_01', 'experiencia_paciente', 1, 'O paciente recebe orientações claras antes da consulta?', 'escala_1_5', 1, true, true),
  ('exp_02', 'experiencia_paciente', 2, 'Existe processo de pós-consulta (retorno, acompanhamento)?', 'escala_1_5', 1, true, true),
  ('exp_03', 'experiencia_paciente', 3, 'A clínica coleta avaliações ou NPS de forma sistemática?', 'escala_1_5', 1, true, true),
  ('exp_04', 'experiencia_paciente', 4, 'Reclamações têm um fluxo definido de tratamento?', 'escala_1_5', 1, true, true),
  ('exp_05', 'experiencia_paciente', 5, 'A experiência presencial (espera, ambiente, equipe) é padronizada?', 'escala_1_5', 1, true, true),

  -- Fonte 6 — Inteligência de Dados
  ('dad_01', 'inteligencia_dados', 1, 'Os indicadores principais da clínica são acompanhados periodicamente?', 'escala_1_5', 1, true, true),
  ('dad_02', 'inteligencia_dados', 2, 'Os dados de agenda e faturamento estão centralizados em um sistema?', 'escala_1_5', 1, true, true),
  ('dad_03', 'inteligencia_dados', 3, 'As decisões de marketing são tomadas com base em dados?', 'escala_1_5', 1, true, true),
  ('dad_04', 'inteligencia_dados', 4, 'É possível medir o retorno de cada canal de aquisição?', 'escala_1_5', 1, true, true),
  ('dad_05', 'inteligencia_dados', 5, 'Existe rotina de revisão de resultados com o time?', 'escala_1_5', 1, true, true),

  -- Fonte 7 — Escala
  ('esc_01', 'escala', 1, 'Os processos críticos estão documentados e são repetíveis?', 'escala_1_5', 1, true, true),
  ('esc_02', 'escala', 2, 'A operação funciona sem depender exclusivamente do médico principal?', 'escala_1_5', 1, true, true),
  ('esc_03', 'escala', 3, 'A equipe tem papéis e responsabilidades definidos?', 'escala_1_5', 1, true, true),
  ('esc_04', 'escala', 4, 'A capacidade de atendimento comporta um crescimento de demanda?', 'escala_1_5', 1, true, true),
  ('esc_05', 'escala', 5, 'Existe plano de expansão (novas unidades, novos serviços, novos profissionais)?', 'escala_1_5', 1, true, true)
ON CONFLICT (codigo) DO NOTHING;
