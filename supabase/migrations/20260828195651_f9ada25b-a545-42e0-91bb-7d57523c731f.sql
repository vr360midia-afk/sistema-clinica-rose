CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('whatsapp-lembretes-diario')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'whatsapp-lembretes-diario');

SELECT cron.schedule(
  'whatsapp-lembretes-diario',
  '0 12 * * *',
  $$
  SELECT net.http_post(
    url := 'https://rogngvhlmgxekfygxrwi.supabase.co/functions/v1/whatsapp-lembretes',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);