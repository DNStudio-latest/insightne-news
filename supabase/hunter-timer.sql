-- Starts the News Hunter every hour, day and night, at 20 minutes past the hour.
-- HOW TO USE (once): paste this whole file into Supabase → SQL Editor, press Run.
-- No key needs to be pasted: it uses the GitHub key already stored in the Vault by timer.sql.
-- To stop the timer later:  select cron.unschedule('hunt-news');

select cron.unschedule('hunt-news') where exists (select 1 from cron.job where jobname = 'hunt-news');
select cron.schedule(
  'hunt-news',
  '20 * * * *',
  $$
  select net.http_post(
    url := 'https://api.github.com/repos/DNStudio-latest/insightne-news/actions/workflows/hunt.yml/dispatches',
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

-- Shows the timer. You should see one row: hunt-news, 20 * * * *, true.
select jobname, schedule, active from cron.job where jobname = 'hunt-news';
