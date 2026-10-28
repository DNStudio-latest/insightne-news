-- A reliable timer for the news collector.
-- GitHub's own timer often skips runs, so Supabase (free) starts the "Collect news" job every 3 hours instead.
--
-- HOW TO USE (once):
--   1. Replace PASTE_YOUR_GITHUB_KEY_HERE below with your GitHub key (keep the quotes ' ').
--   2. Run this whole file in Supabase → SQL Editor.
--   3. Then delete this query from the SQL Editor list, so the key is not left there.
-- Running it again is safe: it replaces the old key and the old timer.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Keep the GitHub key in Supabase's locked safe ("Vault"), not in the timer itself.
delete from vault.secrets where name = 'github_collect_key';
select vault.create_secret('PASTE_YOUR_GITHUB_KEY_HERE', 'github_collect_key', 'Starts the Collect news job on GitHub');

-- Every 3 hours at 30 minutes past (UTC) = 12:00, 3:00, 6:00, 9:00 am/pm in India
select cron.unschedule('collect-news') where exists (select 1 from cron.job where jobname = 'collect-news');
select cron.schedule(
  'collect-news',
  '30 */3 * * *',
  $$
  select net.http_post(
    url := 'https://api.github.com/repos/DNStudio-latest/insightne-news/actions/workflows/collect.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'github_collect_key'),
      'Accept', 'application/vnd.github+json',
      'User-Agent', 'insightne-news-timer',
      'Content-Type', 'application/json'
    ),
    body := '{"ref":"main"}'::jsonb
  );
  $$
);

-- Shows the timer. You should see one row named collect-news.
select jobname, schedule, active from cron.job where jobname = 'collect-news';
