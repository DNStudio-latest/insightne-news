// The people who write for the site: their titles, and how many stories each has published.
import { slugify, bylineName } from "./config.js";

export const SUB_EDITOR = "sub_editor";

const normName = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase();

// May this person edit the Kokborok version of stories? Editors and the admin always may (they edit every story);
// sub-editors only when their name is in settings.json "kokborokEditors".
export function canEditKokborok(user, names = []) {
  if (!user) return false;
  if (user.role !== SUB_EDITOR) return true;
  return names.some((n) => normName(n) === normName(user.name));
}

// The title shown with their name on stories, their reporter page and the team page.
export const staffTitle = (person) => (person?.role === SUB_EDITOR ? "Sub-Editor" : "Reporter");

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
