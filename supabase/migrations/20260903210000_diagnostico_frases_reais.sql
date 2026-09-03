-- As 18 frases por faixa das Fontes 2 a 7, redigidas pelo time IAplicada com
-- base no direcionamento estratégico do Pietro de 03/07. Substituem os
-- placeholders que a migration 20260903140000 tinha deixado.
--
-- Mapeamento da estrutura pedida para as colunas que a tabela já tem
-- (nenhuma coluna duplicada é criada):
--   fonte_numero      → fonte (enum fonte_diagnostico)
--   faixa_inicio      → faixa_min
--   faixa_fim         → faixa_max
--   status            → placeholder (false = final, true = placeholder)
--   autor_placeholder → autor (coluna nova; era a única informação sem lugar)

ALTER TABLE public.diagnostico_frases_por_faixa
  ADD COLUMN IF NOT EXISTS autor text;

COMMENT ON COLUMN public.diagnostico_frases_por_faixa.autor IS
  'Quem redigiu a frase: IAplicada (time) ou Pietro (validada por ele).';
COMMENT ON COLUMN public.diagnostico_frases_por_faixa.placeholder IS
  'true = texto provisório; false = texto final em produção.';

-- Fonte 1 já estava final; passa a registrar a autoria.
UPDATE public.diagnostico_frases_por_faixa
SET autor = 'Pietro'
WHERE fonte = 'posicionamento' AND placeholder = false;

-- As 18 frases entram como finais, assinadas pelo time.
UPDATE public.diagnostico_frases_por_faixa f
SET frase = v.frase,
    placeholder = false,
    autor = 'IAplicada',
    atualizado_em = now()
FROM (VALUES
  -- Fonte 2 · Presença Digital
  ('presenca_digital', 0, 40,
   'Sua presença digital ainda é rasa. O paciente ideal busca online e não te encontra, ou encontra e não se convence. Estruturar site, Google Perfil e conteúdo é a base para qualquer outra Fonte funcionar.'),
  ('presenca_digital', 41, 70,
   'Sua presença digital existe, mas é inconsistente. Site funciona, mas não converte; redes têm movimento, mas sem estratégia. Padronizar canais e ativar SEO desbloqueia captação orgânica.'),
  ('presenca_digital', 71, 100,
   'Presença digital sólida e coerente. Próximo nível é escalar autoridade via produção sistemática de conteúdo especializado e otimização técnica avançada de SEO.'),

  -- Fonte 3 · Aquisição de Pacientes
  ('aquisicao_pacientes', 0, 40,
   'Sua aquisição depende de indicação e sorte. Sem campanhas ativas e funil estruturado, cada mês é um recomeço. Esta é a Fonte com maior alavanca de crescimento imediato no seu cenário.'),
  ('aquisicao_pacientes', 41, 70,
   'Você já capta pacientes de forma ativa, mas ainda sem previsibilidade. Fortalecer CPL, LPs e integração com CRM transforma esforço pontual em fluxo constante.'),
  ('aquisicao_pacientes', 71, 100,
   'Aquisição estruturada e mensurável. Próximo nível é otimização fina de campanhas por segmento e diversificação de canais para reduzir dependência de uma única fonte.'),

  -- Fonte 4 · Conversão
  ('conversao', 0, 40,
   'Você capta leads, mas perde a maioria no atendimento. Tempo de resposta lento, scripts inexistentes e ausência de automação estão consumindo o investimento em aquisição. Corrigir esta Fonte multiplica o retorno de tudo que já é feito.'),
  ('conversao', 41, 70,
   'Sua conversão funciona, mas ainda depende demais de disponibilidade humana. Estruturar scripts padronizados e ativar automação no fora-do-expediente eleva agendamento sem aumentar time.'),
  ('conversao', 71, 100,
   'Conversão consolidada com processo e tecnologia. Próximo nível é otimização por perfil de lead e experimentação contínua de abordagens para maximizar taxa de agendamento.'),

  -- Fonte 5 · Experiência do Paciente
  ('experiencia_paciente', 0, 40,
   'A jornada do paciente na sua clínica ainda é reativa. Sem coleta de NPS, sem processo de indicação e sem fidelização, cada paciente é uma transação isolada. Estruturar experiência transforma paciente em promotor da marca.'),
  ('experiencia_paciente', 41, 70,
   'Experiência tem cuidado, mas processos formais faltam. Sistematizar coleta de avaliação e ativar programa de indicação libera crescimento orgânico com custo zero de aquisição.'),
  ('experiencia_paciente', 71, 100,
   'Experiência excelente e mensurável. Próximo nível é transformar promotores em canal ativo de aquisição via programa formal de embaixadores e conteúdo colaborativo.'),

  -- Fonte 6 · Inteligência de Dados
  ('inteligencia_dados', 0, 40,
   'Você opera no escuro. Sem KPIs monitorados e dashboard em tempo real, decisões são baseadas em sensação. Esta é a Fonte que sustenta todas as outras — sem dados, não há gestão possível.'),
  ('inteligencia_dados', 41, 70,
   'Você mede parte do negócio, mas ainda em planilhas e reativamente. Consolidar KPIs em dashboard único e criar rotina semanal de leitura de dados transforma reação em antecipação.'),
  ('inteligencia_dados', 71, 100,
   'Dados no centro da operação. Próximo nível é análise preditiva — modelagem de LTV, previsão de faturamento e identificação de padrões de churn antes que aconteçam.'),

  -- Fonte 7 · Escala
  ('escala', 0, 40,
   'Sua operação ainda depende diretamente do seu tempo pessoal. Sem processos documentados, sem automação e sem IA, dobrar volume significa dobrar exaustão. Estruturar escala é o único caminho para crescimento sustentável.'),
  ('escala', 41, 70,
   'Você já tem processos, mas replicabilidade ainda é limitada. Ampliar automação para 3+ áreas-chave e integrar IA em pontos de alta repetição libera capacidade real de expansão.'),
  ('escala', 71, 100,
   'Operação madura e escalável. Próximo nível é abrir novas unidades ou verticais mantendo padrão de qualidade — o sistema aguenta, o desafio agora é estratégico.')
) AS v(fonte, faixa_min, faixa_max, frase)
WHERE f.fonte = v.fonte::public.fonte_diagnostico
  AND f.faixa_min = v.faixa_min
  AND f.faixa_max = v.faixa_max;
