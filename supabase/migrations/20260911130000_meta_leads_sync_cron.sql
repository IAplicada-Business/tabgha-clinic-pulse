-- Safety-net: sync_meta_leads roda diariamente pra recuperar leadgen leads
-- que o webhook não capturou (subscribed_apps não confirmado, token expirado,
-- falha transitória etc). O webhook_meta_lead continua sendo o caminho
-- primário (near real-time); isso é só a rede de segurança.
DO $$
DECLARE
  job_id bigint;
  fn_url text;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'sync-meta-leads' LIMIT 1;
    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    fn_url := 'https://vdnxhvvkxfzuqludpmna.supabase.co/functions/v1/sync_meta_leads';

    PERFORM cron.schedule(
      'sync-meta-leads',
      '10 9 * * *',
      format($sql$
        SELECT net.http_post(
          url := %L,
          headers := '{"Content-Type":"application/json"}'::jsonb,
          body := '{"days":3}'::jsonb,
          timeout_milliseconds := 60000
        );
      $sql$, fn_url)
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'sync-meta-leads cron not scheduled: %', SQLERRM;
END
$$;
