-- Editor controls: whether an editor may remove photos, and who edited a sub-editor's story.
-- Paste this into Supabase > SQL Editor and press "Run" once. Running it again is harmless.

-- Editors allowed to remove photos (on by default). Switch it off on /admin/editors with "STOP REMOVING PHOTOS".
alter table editors add column if not exists can_delete boolean not null default true;

-- The name of the editor who last changed a sub-editor's story, shown as "· edited by …" under the byline.
alter table stories add column if not exists edited_by text;
