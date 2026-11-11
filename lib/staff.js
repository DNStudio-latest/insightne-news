// The people who write for the site: their titles, and how many stories each has published.
import { settings, slugify, bylineName } from "./config.js";

export const SUB_EDITOR = "sub_editor";
export const REPORTER = "reporter";

// Sub-editors and reporters see and edit only their own stories (and can't make a story the lead or breaking news).
export const isOwnOnly = (role) => role === SUB_EDITOR || role === REPORTER;

// Do this person's stories go live straight away? (settings.json: "editors", "subEditors", "reporters" → canPublish)
// Otherwise a new story waits in Pending for the admin. The admin always publishes.
export function publishesDirectly(role) {
  if (role === "admin") return true;
  if (role === SUB_EDITOR) return settings.subEditors?.canPublish !== false;
  if (role === REPORTER) return settings.reporters?.canPublish === true;
  return settings.editors?.canPublish === true;
}

const normName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

// May this person edit the Kokborok version of stories? Editors and the admin always may (they edit every story);
// sub-editors and reporters only when their name is in settings.json "kokborokEditors".
export function canEditKokborok(user, names = []) {
  if (!user) return false;
  if (!isOwnOnly(user.role)) return true;
  return names.some((n) => normName(n) === normName(user.name));
}

// The "edited by" name to record when an editor (not a sub-editor, not the admin) changes a sub-editor's story.
// Returns undefined when nothing should be recorded.
export function editedByName(user, existing) {
  if (user?.role !== "editor" || !existing?.author_id || existing.author_id === user.id) return undefined;
  return user.name;
}

// The title shown with their name on stories, their reporter page and the team page.
// Someone who is not on the Editors list (an older byline) is shown as a Reporter.
export function staffTitle(person) {
  if (person?.role === SUB_EDITOR) return "Sub-Editor";
  if (!person || person.role === REPORTER) return "Reporter";
  return "Editor";
}

// { [editor id]: number of published stories }. A story counts for a person by their id (stories written
// after sub-editors were added) or, for older stories, by the name in the byline.
export function storyCounts(rows, editors) {
  const byName = new Map(editors.map((e) => [slugify(e.name), e.id]));
  const ids = new Set(editors.map((e) => e.id));
  const counts = Object.fromEntries(editors.map((e) => [e.id, 0]));
  for (const r of rows || []) {
    const id = ids.has(r.author_id) ? r.author_id : byName.get(slugify(bylineName(r.author)));
    if (id) counts[id] += 1;
  }
  return counts;
}
