-- Renova tokens Meta long-lived antes de expirar (segunda 06:00 UTC).
-- refresh-meta-tokens exige Authorization: Bearer <service_role_key>.
-- A chave é lida em tempo de execução via Supabase Vault (secret
-- "service_role_key"), nunca embutida em texto no comando do cron.
-- Se o secret ou pg_cron/pg_net não existirem, a migration não quebra o deploy.
DO $$
DECLARE
  job_id bigint;
  fn_url text;
  srk text;
BEGIN
  SELECT decrypted_secret INTO srk
  FROM vault.decrypted_secrets
  WHERE name = 'service_role_key'
  LIMIT 1;

  IF srk IS NULL THEN
    RAISE NOTICE 'vault secret "service_role_key" not found — cron refresh-meta-tokens skipped';
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
     AND EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN

    SELECT jobid INTO job_id FROM cron.job WHERE jobname = 'refresh-meta-tokens' LIMIT 1;
    IF job_id IS NOT NULL THEN
      PERFORM cron.unschedule(job_id);
    END IF;

    fn_url := 'https://vdnxhvvkxfzuqludpmna.supabase.co/functions/v1/refresh-meta-tokens';

    PERFORM cron.schedule(
      'refresh-meta-tokens',
      '0 6 * * 1',
      format($sql$
        SELECT net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (
              SELECT decrypted_secret FROM vault.decrypted_secrets
              WHERE name = 'service_role_key' LIMIT 1
            )
          ),
          timeout_milliseconds := 60000
        );
      $sql$, fn_url)
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'refresh-meta-tokens cron not scheduled: %', SQLERRM;
END
$$;
