-- InsightNE News database tables.
-- Paste this whole file into Supabase > SQL Editor and press "Run" once.

create table if not exists stories (
  id uuid primary key default gen_random_uuid(),
  headline text not null,
  summary text not null,
  region text not null default 'Northeast',
  topic text,
  score int not null,
  needs_check boolean not null default false,
  check_reasons text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  auto_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists stories_status_published on stories (status, published_at desc);
create index if not exists stories_status_created on stories (status, created_at desc);

create table if not exists story_sources (
  id bigint generated always as identity primary key,
  story_id uuid not null references stories(id) on delete cascade,
  source_name text not null,
  url text not null unique,
  original_title text,
  published_at timestamptz,
  added_at timestamptz not null default now()
);
create index if not exists story_sources_story on story_sources (story_id);

-- Every article link the collector has already looked at, so it never pays to score it twice.
create table if not exists seen_articles (
  url text primary key,
  source_name text,
  title text,
  score int,
  seen_at timestamptz not null default now()
);
create index if not exists seen_articles_seen_at on seen_articles (seen_at);

-- A short report from each collector run (shown on your approval page).
create table if not exists collector_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  practice_mode boolean not null default false,
  feeds_ok int,
  feeds_failed jsonb not null default '[]',
  articles_new int,
  articles_kept int,
  stories_created int,
  stories_updated int,
  auto_published int,
  error text
);

-- Lock the tables. Only the website and collector (which hold the secret key) can read or write.
alter table stories enable row level security;
alter table story_sources enable row level security;
alter table seen_articles enable row level security;
alter table collector_runs enable row level security;

-- Give the secret key (and nobody else) access, also when "Automatically expose new tables" is off.
grant usage on schema public to service_role;
grant select, insert, update, delete on stories, story_sources, seen_articles, collector_runs to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on stories, story_sources, seen_articles, collector_runs from anon, authenticated;

-- Added for no-AI mode: the short intro from each source's feed, shown only on your private approval page
-- to help you write the summary. (Safe to run this whole file again; it only adds what is missing.)
alter table story_sources add column if not exists snippet text;

-- ===== Added for the full news site: story pages, your own articles, photos, lead story =====
alter table stories add column if not exists slug text;
alter table stories add column if not exists kind text not null default 'brief';   -- 'brief' (from other sites) or 'original' (your own report)
alter table stories add column if not exists body text;                             -- full article text (originals)
alter table stories add column if not exists image_url text;
alter table stories add column if not exists image_caption text;
alter table stories add column if not exists image_credit text;
alter table stories add column if not exists author text;
alter table stories add column if not exists is_lead boolean not null default false;
alter table stories alter column score drop not null;
create unique index if not exists stories_slug on stories (slug);
create index if not exists stories_kind_published on stories (kind, published_at desc);

-- Give every older story a web address (slug), e.g. "cm-opens-new-office-578fab"
update stories
set slug = coalesce(nullif(trim(both '-' from left(regexp_replace(lower(headline), '[^a-z0-9]+', '-', 'g'), 70)), ''), 'story')
           || '-' || left(id::text, 6)
where slug is null;

-- A public folder for your own photos (anyone can view them; only the website can add them)
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do update set public = true;

-- ===== Added for: Bengali version, breaking news, photo galleries, most read =====
alter table stories add column if not exists headline_bn text;   -- Bengali headline
alter table stories add column if not exists summary_bn text;    -- Bengali summary
alter table stories add column if not exists body_bn text;       -- Bengali story text (your own reports, optional)
alter table stories add column if not exists is_breaking boolean not null default false;
alter table stories add column if not exists gallery jsonb not null default '[]';  -- extra photos: [{url, caption}]

-- How many times each story was read, per day (for "Most read")
create table if not exists story_views (
  story_id uuid not null references stories(id) on delete cascade,
  day date not null default (now() at time zone 'Asia/Kolkata')::date,
  views int not null default 0,
  primary key (story_id, day)
);
alter table story_views enable row level security;
grant select, insert, update, delete on story_views to service_role;
revoke all on story_views from anon, authenticated;

-- Adds one view safely, even when many readers open a story at the same time
create or replace function count_view(sid uuid) returns void language sql as $$
  insert into story_views (story_id, day, views) values (sid, (now() at time zone 'Asia/Kolkata')::date, 1)
  on conflict (story_id, day) do update set views = story_views.views + 1;
$$;
revoke all on function count_view(uuid) from public, anon, authenticated;
grant execute on function count_view(uuid) to service_role;

-- ===== Added for: reader polls =====
-- A question with 2 to 4 answers. The newest open poll is shown on the front page.
create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  question_bn text,
  options jsonb not null,                -- [{"text": "Yes", "text_bn": "হ্যাঁ"}, ...]
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);

-- One vote per reader per poll. "voter" is a scrambled code, never the reader's real address.
create table if not exists poll_votes (
  poll_id uuid not null references polls(id) on delete cascade,
  voter text not null,
  choice int not null,
  voted_at timestamptz not null default now(),
  primary key (poll_id, voter)
);
alter table polls enable row level security;
alter table poll_votes enable row level security;
grant select, insert, update, delete on polls, poll_votes to service_role;
revoke all on polls, poll_votes from anon, authenticated;

-- Totals for each answer
create or replace function poll_counts(pid uuid) returns table (choice int, votes bigint) language sql stable as $$
  select choice, count(*) from poll_votes where poll_id = pid group by choice;
$$;
revoke all on function poll_counts(uuid) from public, anon, authenticated;
grant execute on function poll_counts(uuid) to service_role;

-- ===== Added for: breaking-news alerts on readers' phones =====
-- Each row is one phone or computer that tapped "Get alerts". It holds only the browser's delivery address, no name.
create table if not exists push_subscriptions (
  endpoint text primary key,
  keys jsonb not null,
  lang text not null default 'en',
  created_at timestamptz not null default now()
);
alter table push_subscriptions enable row level security;
grant select, insert, update, delete on push_subscriptions to service_role;
revoke all on push_subscriptions from anon, authenticated;
alter table stories add column if not exists notified_at timestamptz;  -- when readers were alerted about this story

-- ===== Added for: daily email newsletter =====
-- Readers who asked for the daily email. Nobody gets emails until they click the link in the confirmation email.
create table if not exists newsletter_subscribers (
  email text primary key,
  token text not null unique,          -- secret code used in the confirm and unsubscribe links
  lang text not null default 'en',
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
alter table newsletter_subscribers enable row level security;
grant select, insert, update, delete on newsletter_subscribers to service_role;
revoke all on newsletter_subscribers from anon, authenticated;

-- A record of each newsletter you sent (so the same day is not sent twice by accident)
create table if not exists newsletter_sends (
  id bigint generated always as identity primary key,
  sent_at timestamptz not null default now(),
  subject text not null,
  recipients int not null default 0
);
alter table newsletter_sends enable row level security;
grant select, insert, update, delete on newsletter_sends to service_role;
revoke all on newsletter_sends from anon, authenticated;

-- ===== Added for: posting stories to your Facebook page =====
alter table stories add column if not exists facebook_post_id text;      -- the Facebook post made for this story
alter table stories add column if not exists facebook_posted_at timestamptz;

-- ===== Added for: Hindi, Assamese and Nepali versions =====
-- {"hi": {"headline": "...", "summary": "..."}, "as": {...}, "ne": {...}}  (Bengali keeps its own columns)
alter table stories add column if not exists translations jsonb not null default '{}';

-- ===== Added for: named editors / reporters =====
-- Each person who may write for the site. Their name appears as the byline ("By …") on stories they write.
-- Passwords are stored only as a scrambled check value, never as the real password.
create table if not exists editors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  password_hash text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table editors enable row level security;
grant select, insert, update, delete on editors to service_role;
revoke all on editors from anon, authenticated;

-- ===== Added for: live broadcasts (and other small site switches) =====
-- One row per setting, e.g. key "live" = {"youtubeId": "...", "title": "...", "source": "...", "startedAt": "..."}
create table if not exists site_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table site_settings enable row level security;
grant select, insert, update, delete on site_settings to service_role;
revoke all on site_settings from anon, authenticated;

-- ===== Added for: posting stories to Instagram =====
alter table stories add column if not exists instagram_post_id text;
alter table stories add column if not exists instagram_posted_at timestamptz;

-- ===== Added for: sub-editors (their own stories, byline title, story counter) =====

-- What each person on /admin/editors is: "editor" (can edit every story) or "sub_editor" (only their own).
alter table editors add column if not exists role text not null default 'editor';

-- Who wrote a story (the sub-editor's id), and the title shown under the byline, e.g. "Sub-Editor".
alter table stories add column if not exists author_id uuid;
alter table stories add column if not exists author_title text;
create index if not exists stories_author_id on stories (author_id);
