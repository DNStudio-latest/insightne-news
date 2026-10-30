-- Sub-editors: team members who write and publish their own stories under their own name.
-- Paste this into Supabase > SQL Editor and press "Run" once. Running it again is harmless.

-- What each person on /admin/editors is: "editor" (can edit every story) or "sub_editor" (only their own).
alter table editors add column if not exists role text not null default 'editor';

-- Who wrote a story (the sub-editor's id), and the title shown under the byline, e.g. "Sub-Editor".
alter table stories add column if not exists author_id uuid;
alter table stories add column if not exists author_title text;
create index if not exists stories_author_id on stories (author_id);
