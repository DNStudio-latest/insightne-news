"use server";
// What the phone "News desk" buttons do. Saving an item never touches the website's stories; only
// "Upload as draft" and "Publish" do, and Publish is for the admin only, after the text was uploaded unchanged.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { db } from "../../../lib/db.js";
import { settings, regions } from "../../../lib/config.js";
import { currentUser } from "../../../lib/auth.js";
import { publishesDirectly } from "../../../lib/staff.js";
import { savePhoto, PhotoError } from "../../../lib/photo.js";
import { refreshSite } from "../../../lib/site-cache.js";
import { finishPublishing } from "../../../lib/after-publish.js";
import { cleanText } from "../../../lib/clean-text.js";
import { saveItem, markItem, deleteItem, getItem, loadItems, textHash } from "../../../lib/desk-store.js";

// Only the admin and editors use the desk (sub-editors and reporters keep using "Write a story").
async function deskUser() {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "admin" && user.role !== "editor") redirect("/admin");
  return user;
}

function refreshPages() {
  revalidatePath("/", "layout");
  revalidatePath("/[lang]", "layout");
  refreshSite();
}

export async function listDeskItems() {
  await deskUser();
  return loadItems();
}

export async function saveDeskItem(raw) {
  await deskUser();
  try {
    return { ok: true, item: await saveItem(raw) };
  } catch (err) {
    return { ok: false, error: `Could not save: ${err.message}` };
  }
}

export async function deleteDeskItem(id) {
  await deskUser();
  await deleteItem(String(id));
  return { ok: true };
}

// A photo from the phone. The phone already made it smaller; the server checks it is a real photo.
export async function uploadDeskPhoto(formData) {
  await deskUser();
  const file = formData.get("photo");
  if (!file || typeof file !== "object" || !file.size) return { ok: false, error: "No photo was received." };
  if (file.size > 4 * 1024 * 1024) return { ok: false, error: "The photo is too big (over 4 MB)." };
  try {
    const url = await savePhoto(db, new Uint8Array(await file.arrayBuffer()));
    return { ok: true, url };
  } catch (err) {
    if (err instanceof PhotoError) return { ok: false, error: err.message };
    return { ok: false, error: `The photo could not be saved: ${err.message}` };
  }
}

function storyFields(item, user) {
  return {
    kind: "original",
    headline: cleanText(String(item.headline || "").trim().slice(0, 200)),
    summary: String(item.intro || "").trim().slice(0, 600),
    body: String(item.story || "").trim().slice(0, 60000),
    region: regions.includes("Tripura") ? "Tripura" : regions[0],
    topic: null,
    // The owner's byline is "P Debnath" (as in the Windows app); an editor's stories carry that editor's own name.
    author: user.role === "admin" ? "P Debnath" : user.name || settings.defaultAuthor,
    image_url: item.no_photo ? null : item.photo_url || null,
    image_caption: String(item.photo_caption || "").trim().slice(0, 300) || null,
    image_credit: String(item.photo_credit || "").trim().slice(0, 120) || null,
  };
}

// "Upload as draft": saves (or updates) the story on the website as PENDING. It is not on the site until published.
export async function uploadDraft(id) {
  const user = await deskUser();
  const item = await getItem(String(id));
  if (!item) return { ok: false, error: "This item was not found." };
  const f = storyFields(item, user);
  if (!f.headline) return { ok: false, error: "Write a headline first." };
  if (!f.body) return { ok: false, error: "Write the story text first." };
  if (!f.summary) return { ok: false, error: "Write the intro first." };
  try {
    let storyId = item.draft_story_id;
    const existing = storyId ? await db.getStory(storyId) : null;
    if (existing && existing.status === "approved") {
      return { ok: false, error: "This story is already published on the website. Edit it there." };
    }
    if (existing) await db.updateStory(storyId, { ...f, status: "pending", published_at: null });
    else storyId = await db.createStory({ ...f, status: "pending", published_at: null, score: null, needs_check: false, check_reasons: [] });
    const saved = await markItem(item.id, { draft_story_id: storyId, uploaded_hash: textHash(item), uploaded_at: new Date().toISOString(), published: false });
    return { ok: true, item: saved, draftUrl: `/admin/write?id=${storyId}` };
  } catch (err) {
    return { ok: false, error: `The website did not accept the draft: ${err.message}` };
  }
}

// "Publish": admin only; the draft must exist and the text must be exactly what was uploaded;
// the phone has already asked twice ("confirmed" is sent only after the second confirmation).
export async function publishNow(id, confirmed) {
  const user = await deskUser();
  if (confirmed !== "PUBLISH") return { ok: false, error: "Publishing was not confirmed." };
  if (!publishesDirectly(user.role)) return { ok: false, error: "Only the admin can publish. Your draft waits in Pending." };
  const item = await getItem(String(id));
  if (!item?.draft_story_id) return { ok: false, error: "Upload as draft first." };
  if (item.uploaded_hash !== textHash(item)) return { ok: false, error: "The text changed after the last upload. Upload as draft again, then publish." };
  try {
    const story = await db.getStory(item.draft_story_id);
    if (!story) return { ok: false, error: "The draft is no longer on the website. Upload as draft again." };
    if (!story.summary?.trim() || !story.body?.trim()) return { ok: false, error: "The draft has no intro or story text." };
    await db.updateStory(story.id, { status: "approved", published_at: story.published_at || new Date().toISOString(), needs_check: false, check_reasons: [] });
    after(() => finishPublishing(db, story.id, refreshPages));
    refreshPages();
    const saved = await markItem(item.id, { published: true, published_at: new Date().toISOString() });
    return { ok: true, item: saved };
  } catch (err) {
    return { ok: false, error: `Publishing failed: ${err.message}` };
  }
}
