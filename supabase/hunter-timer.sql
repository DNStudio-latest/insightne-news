-- Starts the News Hunter at 2 PM, 6 PM and 9 PM India time.
-- HOW TO USE (once, after testing the Hunter by hand): paste this whole file into Supabase → SQL Editor, press Run.
-- No key needs to be pasted: it uses the GitHub key already stored in the Vault by timer.sql.
-- To stop the timer later:  select cron.unschedule('hunt-news');

-- Timer: 08:30, 12:30 and 15:30 UTC = 2:00 PM, 6:00 PM and 9:00 PM in India.
select cron.unschedule('hunt-news') where exists (select 1 from cron.job where jobname = 'hunt-news');
select cron.schedule(
  'hunt-news',
  '30 8,12,15 * * *',
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

-- Shows the timer. You should see one row named hunt-news.
select jobname, schedule, active from cron.job where jobname = 'hunt-news';
