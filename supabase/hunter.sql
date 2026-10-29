-- The News Hunter's tables.
-- HOW TO USE (once): copy this whole file, paste it into Supabase → SQL Editor, press Run.
-- Running it again is safe.

-- Every list page the Hunter watches: when it was first read (the first visit only remembers what is already there).
create table if not exists hunter_pages (
  url text primary key,
  source_name text,
  first_seen timestamptz not null default now(),
  last_ok timestamptz,
  last_error text,
  last_error_at timestamptz
);

-- Every link, PDF and video the Hunter has found. A PDF is never read twice: same link or same "fingerprint".
create table if not exists hunter_items (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  fingerprint text,                 -- SHA-256 of the downloaded file
  source_name text,
  state text,
  kind text,                        -- pdf, page or video
  title text,
  published_at timestamptz,
  text text,
  method text,                      -- how the text was read: page, text, ocr, gemini, unreadable
  language text,
  status text not null default 'queued',  -- queued, ready, chosen, drafted, merged, skipped, baseline, old, duplicate, unreadable, error
  score int,
  reason text,
  event text,
  draft_id uuid,
  found_at timestamptz not null default now()
);
create index if not exists hunter_items_status on hunter_items (status, found_at);
create index if not exists hunter_items_fingerprint on hunter_items (fingerprint);

-- The drafts waiting for you on the approval page (🕵 News Hunter tab). Nothing is published without APPROVE.
create table if not exists hunter_drafts (
  id uuid primary key default gen_random_uuid(),
  state text not null,
  topic text,
  headline text not null,
  body text not null,
  sources jsonb not null default '[]',   -- [{ name, url, title, kind }]
  flags text[] not null default '{}',    -- check, kokborok, deleted …
  problems text[] not null default '{}', -- what the safety checks found
  score int,
  language text,
  event text,
  event_at timestamptz not null default now(),
  status text not null default 'pending', -- pending, approved, rejected
  story_id uuid references stories(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hunter_drafts_status on hunter_drafts (status, event_at desc);

create table if not exists hunter_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  pages_ok int not null default 0,
  pages_failed jsonb not null default '[]',
  items_new int not null default 0,
  items_read int not null default 0,
  drafts_created int not null default 0,
  error text
);

-- Only the website's secret key may read these tables (the same protection as your other tables).
alter table hunter_pages enable row level security;
alter table hunter_items enable row level security;
alter table hunter_drafts enable row level security;
alter table hunter_runs enable row level security;

-- The timer is in hunter-timer.sql: run it after testing the Hunter by hand.
