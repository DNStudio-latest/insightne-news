-- The election watcher: checks the election offices' websites every 15 minutes (see lib/hunter/watch.js).
-- HOW TO USE (once): do not paste this file. Open data/election-watch-ready.sql on the main PC instead: it is the
-- same text with the password already filled in (that file is never uploaded to GitHub). Paste it into
-- Supabase → SQL Editor and press Run. Running it again is safe.
-- To stop the watcher later:  select cron.unschedule('election-watch');

-- The password the website asks for. It is made from the Supabase secret key (see watchToken in lib/hunter/watch.js).
delete from vault.secrets where name = 'election_watch_key';
select vault.create_secret('PASTE_ELECTION_WATCH_KEY_HERE', 'election_watch_key', 'Starts the election watcher on the website');

-- Every 15 minutes, day and night.
select cron.unschedule('election-watch') where exists (select 1 from cron.job where jobname = 'election-watch');
select cron.schedule(
  'election-watch',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://www.insightnenews.in/api/election-watch',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'election_watch_key')
    ),
    timeout_milliseconds := 60000
  );
  $$
);

-- Shows the timer. You should see one row named election-watch.
select jobname, schedule, active from cron.job where jobname = 'election-watch';
