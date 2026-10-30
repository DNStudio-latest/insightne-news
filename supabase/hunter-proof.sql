-- Screenshots of the News Hunter's sources (proof), and the switch to use one as the photo illustration.
-- HOW TO USE (once): copy this whole file, paste it into Supabase → SQL Editor, press Run.
-- Running it again is safe.

-- A private place for the screenshots (nobody can see them without signing in to the admin page).
insert into storage.buckets (id, name, public)
values ('hunter-proof', 'hunter-proof', false)
on conflict (id) do nothing;

-- Each draft: is its screenshot used as the photo when you approve? Off until you switch it on.
alter table hunter_drafts add column if not exists use_photo boolean not null default false;
alter table hunter_drafts add column if not exists photo_index int not null default 0;
