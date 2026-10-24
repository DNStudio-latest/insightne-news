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
