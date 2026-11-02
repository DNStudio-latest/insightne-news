-- Pin to front page: lets the admin keep an older, important story at the top of the front page.
-- Run once: Supabase -> SQL Editor -> New query -> paste all of this -> Run.
-- Safe to run twice. The story's real publish date is never changed.
alter table public.stories add column if not exists pinned_at timestamptz;
create index if not exists stories_pinned_at_idx on public.stories (pinned_at) where pinned_at is not null;
