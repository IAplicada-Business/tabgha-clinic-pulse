-- Nutrição de leads · sequências A, B e C com os textos oficiais.
--
-- Decisões anti-duplicação (requisito permanente do cliente):
--   * NÃO cria tabela nova — reaproveita public.nurture_jobs.
--   * NÃO cria status novos no funil. Os gatilhos do briefing
--     (perdido_sem_plano / aguardando_resposta / consulta_realizada) são
--     mapeados nos status que já existem em leads_status_check:
--       Sequência A → status 'perdido' + motivo_perda 'sem_plano'
--       Sequência B → status 'em_conversa' parado há N dias
--       Sequência C → status 'atendido'
--     O status disparador é configurável na tela (app_config), então trocar o
--     mapeamento não exige migration.
--   * NÃO cria motor paralelo: as duas automações antigas viram sequências.
--       cold_followup → seq_b   (mesma intenção: lead sem resposta)
--       review_ask    → seq_c   (mesma intenção: pós-atendimento + review)
--   * NÃO cria menu novo: /admin/nutricao entra como submenu de
--     "Automações de pacientes", que já existe.

-- ── 1. nurture_jobs: kinds passam a ser as 3 sequências ──────────────────────

-- O CHECK antigo (cold_followup/review_ask) bloqueia o próprio UPDATE, então
-- ele sai antes e o novo entra depois.
ALTER TABLE public.nurture_jobs DROP CONSTRAINT IF EXISTS nurture_jobs_kind_check;

UPDATE public.nurture_jobs SET kind = 'seq_b' WHERE kind = 'cold_followup';
UPDATE public.nurture_jobs SET kind = 'seq_c' WHERE kind = 'review_ask';

ALTER TABLE public.nurture_jobs ADD CONSTRAINT nurture_jobs_kind_check
  CHECK (kind IN ('seq_a', 'seq_b', 'seq_c'));

-- Registro de qual mensagem da sequência já saiu (histórico no card do lead).
ALTER TABLE public.nurture_jobs
  ADD COLUMN IF NOT EXISTS enviadas jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.nurture_jobs.enviadas IS
  'Lista de {mensagem:int, texto:text, enviada_em:timestamptz} já disparados nesta sequência.';

-- Os jobs travados em failed/no_connected_instance vieram do motor antigo, que
-- enfileirava leads de clientes sem WhatsApp conectado. O motor novo checa a
-- instância antes de enfileirar; aqui limpamos o passivo.
DELETE FROM public.nurture_jobs
WHERE status = 'failed' AND last_error = 'no_connected_instance';

-- ── 2. Enfileiramento sai do trigger e passa a ser só do nurture-tick ────────
-- Antes havia dois caminhos (trigger no INSERT/UPDATE de leads + varredura no
-- cron). Um caminho só evita job duplicado e deixa o gatilho configurável.

DROP TRIGGER IF EXISTS trg_leads_enqueue_review ON public.leads;
DROP FUNCTION IF EXISTS public.enqueue_review_ask();

-- ── 3. Configuração das sequências (textos oficiais) ────────────────────────

INSERT INTO public.app_config (chave, valor)
VALUES ('nurture_defaults', $json$
{
  "timezone": "America/Sao_Paulo",
  "hora_envio": 10,
  "sequencias": {
    "seq_a": {
      "nome": "Lead perdido sem plano de tratamento",
      "ativo": true,
      "gatilho_status": "perdido",
      "gatilho_motivo_perda": "sem_plano",
      "mensagens": [
        {
          "dia": 7,
          "texto": "Olá, {primeiro_nome}. Aqui é o assistente da Tabgha OS.\nEntendo que no momento você optou por não seguir com o plano proposto. Isso é absolutamente normal — nem todo momento é o momento certo.\nSe quiser, deixo com você um material curto sobre {tema_da_especialidade} que ajuda a organizar a decisão sem pressão:\n{link_material}\nE, quando fizer sentido, um Diagnóstico Estratégico gratuito de 45 minutos está disponível para mapear o cenário completo da sua rotina. É só responder essa mensagem com \"quero agendar\".\nFico à disposição."
        }
      ]
    },
    "seq_b": {
      "nome": "Lead perdido sem resposta",
      "ativo": true,
      "gatilho_status": "em_conversa",
      "gatilho_idle_dias": 5,
      "mensagens": [
        {
          "dia": 3,
          "texto": "Olá, {primeiro_nome}.\nVi que nossa conversa ficou aberta e queria ter certeza de que você recebeu as informações que precisava.\nTem algo específico que posso esclarecer? Estou por aqui."
        },
        {
          "dia": 7,
          "texto": "{primeiro_nome}, separei um material que costuma ser útil para quem está avaliando estruturar essa área na clínica:\n{link_conteudo_autoridade}\nSe preferir uma conversa direta em vez de leitura, também dá pra agendar 15 min sem compromisso. Como fica melhor?"
        },
        {
          "dia": 15,
          "texto": "{primeiro_nome}, vou pausar nosso contato por aqui para não te sobrecarregar.\nSe mudar de ideia ou quiser retomar em outro momento, é só responder essa mensagem que eu retomo na hora.\nUm abraço da Tabgha OS."
        }
      ]
    },
    "seq_c": {
      "nome": "Lead atendido",
      "ativo": true,
      "gatilho_status": "atendido",
      "mensagens": [
        {
          "dia": 1,
          "texto": "Olá, {primeiro_nome}. Espero que a consulta com o {nome_medico} tenha atendido suas expectativas.\nSe puder compartilhar sua experiência em uma avaliação no Google, você ajuda outras pessoas a encontrarem um atendimento de confiança:\n{link_google_avaliacao}\nLeva 30 segundos. Obrigado desde já."
        },
        {
          "dia": 30,
          "texto": "Olá, {primeiro_nome}. Faz 30 dias da sua consulta com o {nome_medico}.\nComo está o acompanhamento? Se quiser retomar alguma coisa ou apenas conversar sobre próximos passos, é só responder por aqui.\nEstamos à disposição."
        }
      ]
    }
  }
}
$json$::jsonb)
ON CONFLICT (chave) DO UPDATE SET valor = EXCLUDED.valor;

-- ── 4. Histórico da automação no card do lead ───────────────────────────────
-- automation_logs já existe e já recebe uma linha por envio; faltava o cliente
-- conseguir ler (o card do lead abre igual no portal) e um índice pro lead_id.

CREATE INDEX IF NOT EXISTS idx_automation_logs_lead
  ON public.automation_logs ((metadata ->> 'lead_id'), criado_em DESC);

DROP POLICY IF EXISTS automation_logs_staff_select ON public.automation_logs;
CREATE POLICY automation_logs_staff_select ON public.automation_logs
  FOR SELECT
  USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS automation_logs_cliente_select ON public.automation_logs;
CREATE POLICY automation_logs_cliente_select ON public.automation_logs
  FOR SELECT
  USING (cliente_id = public.current_cliente_id());

GRANT SELECT ON public.automation_logs TO authenticated;
