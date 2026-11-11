"use server";
// What happens when you press a button on the approval page.
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { refreshSite } from "../../lib/site-cache.js";
import { MAX_PINNED } from "../../lib/pins.js";
import { after } from "next/server";
import { compressPhoto, PhotoError } from "../../lib/photo.js";
import { sendAlert } from "../../lib/push.js";
import { shareOnFacebook } from "../../lib/facebook.js";
import { shareOnInstagram } from "../../lib/instagram.js";
import { logSocial, checkSocial } from "../../lib/social.js";
import { finishPublishing } from "../../lib/after-publish.js";
import { publishHunterDraft } from "../../lib/hunter/publish.js";
import { sendEmail, dailyEmail, FREE_DAILY_LIMIT } from "../../lib/newsletter.js";
import { topStories } from "../../lib/top.js";
import { formatDay, youtubeId } from "../../lib/format.js";
import { db } from "../../lib/db.js";
import { hunterStore } from "../../lib/hunter/store.js";
import { hasCheckMarks } from "../../lib/hunter/checks.js";
import { settings, regions } from "../../lib/config.js";
import { currentRole, currentUser, userForPassword, hashPassword, startSession, endSession } from "../../lib/auth.js";
import { SUB_EDITOR, REPORTER, isOwnOnly, publishesDirectly, staffTitle, canEditKokborok, editedByName } from "../../lib/staff.js";
import { translationsAfterEdit } from "../../lib/languages.js";
import { researchAndDraft } from "../../lib/research.js";
import { loadLessons } from "../../lib/ai-lessons-store.js";
import { clientIp, rateLimit } from "../../lib/rate-limit.js";
import { totpEnabled, verifyTotp } from "../../lib/totp.js";
import { cleanText } from "../../lib/clean-text.js";

// Any signed-in person. Returns "admin", "editor", "sub_editor" or "reporter".
async function requireLogin() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  return role;
}

// Only you (the admin): publishing, rejecting, polls, alerts, Facebook, email.
async function requireAdmin() {
  const role = await requireLogin();
  if (role !== "admin") redirect(`/admin?done=${encodeURIComponent("Only the admin can do that.")}`);
}

// Shows the change on the website straight away.
function refreshPages() {
  revalidatePath("/", "layout");
  refreshSite();
}

function refresh(view = "pending", notice = "") {
  refreshPages();
  redirect(`/admin?view=${view}${notice ? `&done=${encodeURIComponent(notice)}` : ""}`);
}

// After a story is published, in the background: make its AI illustration (only if Cloudflare is set up),
// then post it to Facebook if "autoPost" is switched on in settings.json.
function illustrateLater(id) {
  after(() => finishPublishing(db, id, refreshPages));
}

function editedFields(formData) {
  const headline = String(formData.get("headline") || "").trim().slice(0, 200);
  const summary = String(formData.get("summary") || "").trim().slice(0, 1200);
  const region = regions.includes(formData.get("region")) ? formData.get("region") : regions[0];
  const topic = settings.topics.includes(formData.get("topic")) ? formData.get("topic") : null;
  if (!headline || !summary) refresh(String(formData.get("view") || "pending"), "Headline and summary cannot be empty");
  // Bengali version (optional). Empty boxes are filled by Gemini at the next run.
  const headline_bn = String(formData.get("headline_bn") || "").trim().slice(0, 300) || null;
  const summary_bn = String(formData.get("summary_bn") || "").trim().slice(0, 2000) || null;
  return { headline, summary, region, topic, headline_bn, summary_bn };
}

export async function login(formData) {
  // After 10 tries from one address in 15 minutes there are no more guesses for a while.
  if (!(await rateLimit({ key: `login:${clientIp(await headers())}`, limit: 10, windowSec: 900 })).ok) redirect("/admin/login?limited=1");
  // A short pause makes guessing passwords slower.
  await new Promise((r) => setTimeout(r, 800));
  const user = await userForPassword(String(formData.get("password") || ""));
  // Two-step sign-in for the admin (only when ADMIN_TOTP_SECRET is set): the 6-digit code from the authenticator app.
  const secondStep = !user || user.role !== "admin" || !totpEnabled() || verifyTotp(process.env.ADMIN_TOTP_SECRET, formData.get("code"));
  if (!user || !secondStep) redirect("/admin/login?wrong=1");
  await startSession(user);
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

export async function approve(formData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  // Nothing goes on the website without a summary.
  const story = await db.getStory(id);
  if (!story?.summary?.trim()) refresh("pending", "Write a summary before approving (tap WRITE SUMMARY)");
  await db.updateStory(id, { status: "approved", published_at: new Date().toISOString() });
  illustrateLater(id);
  refresh("pending", "Published");
}

export async function reject(formData) {
  await requireAdmin();
  await db.updateStory(String(formData.get("id")), { status: "rejected", published_at: null });
  refresh("pending", "Rejected");
}

// Saves the "edited by" name too. If supabase/editor-controls.sql has not been run yet, saves everything else.
async function updateWithMark(id, fields) {
  try {
    await db.updateStory(id, fields);
  } catch (err) {
    if (!("edited_by" in fields)) throw err;
    const { edited_by, ...rest } = fields;
    await db.updateStory(id, rest);
  }
}

// Photo, caption and credit from a form. Keeps the old photo unless a new one is chosen or "Remove photo" is tapped.
// People with canDelete off cannot remove the photo.
async function photoFields(formData, existing, onError, canDelete = true) {
  const fields = {
    image_caption: text(formData, "image_caption", 300) || null,
    image_credit: text(formData, "image_credit", 120) || null,
    image_url: formData.get("removeImage") && canDelete ? null : existing?.image_url || null,
  };
  const file = formData.get("image");
  if (file && typeof file === "object" && file.size > 0) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) onError("The photo must be a JPG, PNG or WEBP image.");
    if (file.size > 4 * 1024 * 1024) onError("The photo is too big (over 4 MB).");
    // The real type is read from the file itself; a file that is not a photo is refused.
    const photo = await compressPhoto(new Uint8Array(await file.arrayBuffer())).catch((err) => (err instanceof PhotoError ? onError(err.message) : Promise.reject(err)));
    fields.image_url = await db.uploadImage(photo.bytes, photo.contentType);
  }
  return fields;
}

// The Kokborok version typed in the editor. Both boxes empty = none (Gemini writes it again at the next run).
// Returns undefined when the form has no Kokborok boxes at all.
function kokborokFrom(formData, fail) {
  if (!formData.has("headline_trp")) return undefined;
  const headline = String(formData.get("headline_trp") || "").trim().slice(0, 300);
  const summary = String(formData.get("summary_trp") || "").trim().slice(0, 2000);
  if (Boolean(headline) !== Boolean(summary)) fail("Fill in both Kokborok boxes, or leave both empty");
  return headline ? { headline, summary } : null;
}

export async function saveEdit(formData) {
  const role = await requireLogin();
  const user = await currentUser();
  const id = String(formData.get("id"));
  const view = String(formData.get("view") || "pending");
  const existing = await db.getStory(id);
  const fail = (message) => refresh(view, message);
  // Sub-editors and reporters may change their own stories. One named in settings.json "kokborokEditors" may also change
  // the Kokborok version of any other story, and nothing else on it.
  const kokOnly = isOwnOnly(role) && existing?.author_id !== user?.id;
  if (kokOnly && !(existing && canEditKokborok(user, settings.kokborokEditors?.names))) fail("You can edit only your own stories");
  const kok = kokborokFrom(formData, fail);
  if (kokOnly) {
    await db.updateStory(id, { translations: translationsAfterEdit(existing, false, kok) });
    refresh(view, "Kokborok version saved");
  }
  const fields = { ...editedFields(formData), ...(await photoFields(formData, existing, fail, user?.canDelete !== false)) };
  // If the English text changed, the Hindi/Assamese/Nepali versions are made again at the next collector run.
  const englishChanged = fields.headline !== existing?.headline || fields.summary !== existing?.summary;
  if (englishChanged || kok !== undefined) fields.translations = translationsAfterEdit(existing, englishChanged, kok);
  const mark = editedByName(user, existing);
  if (mark) fields.edited_by = mark; // an editor changed a sub-editor's story: their name is shown with the sub-editor's
  if (formData.get("andApprove") && role === "admin") {
    await db.updateStory(id, { ...fields, status: "approved", published_at: new Date().toISOString() });
    illustrateLater(id);
    refresh("pending", "Saved and published");
  }
  await updateWithMark(id, fields);
  refresh(String(formData.get("view") || "pending"), "Changes saved");
}

export async function unpublish(formData) {
  await requireAdmin();
  await db.updateStory(String(formData.get("id")), { status: "pending", published_at: null });
  refresh("published", "Taken off the website and moved back to Pending");
}

export async function restore(formData) {
  await requireAdmin();
  await db.updateStory(String(formData.get("id")), { status: "pending" });
  refresh("rejected", "Moved back to Pending");
}

export async function toggleBreaking(formData) {
  await requireAdmin();
  const on = !formData.get("remove");
  await db.updateStory(String(formData.get("id")), { is_breaking: on });
  refresh("published", on ? "Breaking banner is on for this story (it switches off by itself after 12 hours)" : "Breaking banner switched off");
}

// Keeps an older, important story at the top of the front page (or takes it off). The publish date is never changed.
export async function togglePin(formData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const remove = Boolean(formData.get("remove"));
  let failed = false;
  try {
    await db.setPinned(id, !remove);
  } catch {
    failed = true;
  }
  if (failed) refresh("published", "Pinning is not set up yet: run supabase/pin-stories.sql in Supabase first");
  refresh("published", remove ? "Unpinned from the front page" : `Pinned to the top of the front page sections (at most ${MAX_PINNED} stay pinned; the oldest pin is released)`);
}

export async function makeLead(formData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await db.setLead(formData.get("remove") ? null : id);
  refresh("published", formData.get("remove") ? "Removed as lead story" : "This is now the lead story on the front page");
}

const text = (formData, name, max) => String(formData.get(name) || "").trim().slice(0, max);

// Your own reports, written in the "Write a story" editor.
export async function saveOriginal(formData) {
  const role = await requireLogin();
  const user = await currentUser();
  const id = text(formData, "id", 60);
  const existing = id ? await db.getStory(id) : null;
  const sub = isOwnOnly(role);
  // Sub-editors and reporters may open and change only the stories they wrote.
  if (sub && existing && existing.author_id !== user.id) refresh("published", "You can edit only your own stories");
  // Who publishes directly is set in settings.json (editors, subEditors, reporters → canPublish); otherwise a new story
  // waits in Pending for your approval.
  const canPublish = publishesDirectly(role);
  const editorSends = !canPublish && formData.get("intent") === "publish" && existing?.status !== "approved";
  const publish = canPublish ? formData.get("intent") === "publish" || (role !== "admin" && existing?.status === "approved") : existing?.status === "approved";
  const backToEditor = (message) => redirect(`/admin/write?${id ? `id=${id}&` : ""}error=${encodeURIComponent(message)}`);
  const kok = kokborokFrom(formData, backToEditor);

  const fields = {
    kind: "original",
    headline: text(formData, "headline", 200),
    summary: text(formData, "summary", 600),
    body: String(formData.get("body") || "").trim().slice(0, 60000),
    region: regions.includes(formData.get("region")) ? formData.get("region") : regions[0],
    topic: settings.topics.includes(formData.get("topic")) ? formData.get("topic") : null,
    // The byline. Sub-editors: always their own name. Editors: their own name on new stories; editing someone
    // else's story keeps that writer's name. Admin: what you typed in "Written by" (your name is filled in for you).
    author: sub ? user.name : role === "editor" ? existing?.author || user.name : text(formData, "author", 120) || user.name || settings.defaultAuthor,
    headline_bn: text(formData, "headline_bn", 300) || null,
    summary_bn: text(formData, "summary_bn", 2000) || null,
    body_bn: String(formData.get("body_bn") || "").trim().slice(0, 60000) || null,
  };
  // A sub-editor's or reporter's story is theirs: it counts for them and shows their title under the byline.
  if (sub) Object.assign(fields, { author_id: user.id, author_title: staffTitle({ role }) });
  if (!fields.headline) backToEditor("Please write a headline.");
  const englishChanged = Boolean(existing) && (fields.headline !== existing.headline || fields.summary !== existing.summary);
  if (englishChanged || kok !== undefined) fields.translations = translationsAfterEdit(existing, englishChanged, kok);
  if (publish && (!fields.summary || !fields.body)) backToEditor("Please write the intro and the story text before publishing.");
  const canDelete = user?.canDelete !== false;
  Object.assign(fields, await photoFields(formData, existing, backToEditor, canDelete));
  const mark = editedByName(user, existing);
  if (mark) fields.edited_by = mark; // an editor changed a sub-editor's story: their name is shown with the sub-editor's

  // Gallery: keep the ticked photos, add the new ones (at most 20 in total). People with canDelete off keep every photo.
  const keep = new Set(formData.getAll("keepGallery").map(String));
  const gallery = (existing?.gallery || []).filter((g) => !canDelete || keep.has(g.url));
  for (const file of formData.getAll("galleryFiles")) {
    if (!file || typeof file !== "object" || !file.size || gallery.length >= 20) continue;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 4 * 1024 * 1024) continue;
    const photo = await compressPhoto(new Uint8Array(await file.arrayBuffer())).catch((err) => (err instanceof PhotoError ? null : Promise.reject(err)));
    if (!photo) continue; // not a real photo: skipped
    gallery.push({ url: await db.uploadImage(photo.bytes, photo.contentType), caption: null });
  }
  fields.gallery = gallery;

  if (publish) {
    // Publishing from the editor is the editor's check, so the "needs check" note is cleared.
    Object.assign(fields, { status: "approved", published_at: existing?.published_at || new Date().toISOString(), needs_check: false, check_reasons: [] });
  } else {
    Object.assign(fields, { status: "pending", published_at: null });
  }

  // A double tap on PUBLISH (or a slow phone connection sending the form twice) must not make the story twice:
  // the same headline by the same writer saved in the last 5 minutes is the same story.
  const twin = existing
    ? null
    : (await db.listStories({ status: fields.status, kind: "original", limit: 20 })).find(
        (s) => s.headline === cleanText(fields.headline) && s.author === cleanText(fields.author) && Date.now() - new Date(s.created_at).getTime() < 5 * 60000,
      );
  let storyId = id || twin?.id;
  if (existing) await updateWithMark(id, fields);
  else if (twin) await updateWithMark(twin.id, fields);
  else storyId = await db.createStory({ ...fields, score: null, needs_check: false, check_reasons: [] });

  const wantsLead = role === "admin" ? Boolean(formData.get("is_lead")) : Boolean(existing?.is_lead);
  if (publish && wantsLead) await db.setLead(storyId);
  if (publish && !existing?.published_at && !twin) illustrateLater(storyId); // the twin already had its photo and Facebook post
  else if (existing?.is_lead && (!wantsLead || !publish)) await db.setLead(null);

  if (editorSends) refresh("pending", "Sent for approval — the admin will publish it");
  refresh(publish ? "published" : "pending", publish ? "Your story is published" : "Draft saved — find it under Pending");
}

// ---- Reader polls ----
export async function savePoll(formData) {
  await requireAdmin();
  const question = text(formData, "question", 200);
  const options = [0, 1, 2, 3]
    .map((i) => ({ text: text(formData, `option${i}`, 80), text_bn: text(formData, `option${i}_bn`, 120) || null }))
    .filter((o) => o.text);
  if (!question || options.length < 2) redirect(`/admin/polls?error=${encodeURIComponent("Write a question and at least two answers.")}`);
  // Only one poll is shown at a time, so the new one closes the old ones.
  for (const p of await db.listPolls()) if (p.is_open) await db.updatePoll(p.id, { is_open: false });
  await db.createPoll({ question, question_bn: text(formData, "question_bn", 300) || null, options });
  refreshPages();
  redirect(`/admin/polls?done=${encodeURIComponent("Poll is live on the front page")}`);
}

export async function togglePoll(formData) {
  await requireAdmin();
  const id = text(formData, "id", 60);
  const open = !formData.get("close");
  if (open) for (const p of await db.listPolls()) if (p.is_open) await db.updatePoll(p.id, { is_open: false });
  await db.updatePoll(id, { is_open: open });
  refreshPages();
  redirect(`/admin/polls?done=${encodeURIComponent(open ? "Poll is back on the front page" : "Poll closed and taken off the front page")}`);
}

export async function deletePoll(formData) {
  await requireAdmin();
  await db.deletePoll(text(formData, "id", 60));
  refreshPages();
  redirect(`/admin/polls?done=${encodeURIComponent("Poll deleted")}`);
}

// ---- Phone alerts ----
export async function notifyReaders(formData) {
  await requireAdmin();
  const id = text(formData, "id", 60);
  const story = await db.getStory(id);
  if (story?.status !== "approved") refresh("published", "Only published stories can be sent as alerts");
  if (story.notified_at && !formData.get("again")) refresh("published", "Readers were already alerted about this story");
  let result;
  try {
    result = await sendAlert(db, { story, url: `${settings.siteUrl}/story/${story.slug}` });
  } catch (err) {
    refresh("published", err.message);
  }
  await db.updateStory(id, { notified_at: new Date().toISOString() });
  refresh("published", `Alert sent to ${result.sent} of ${result.total} phones/computers`);
}

// ---- Daily email ----
export async function sendNewsletter(formData) {
  await requireAdmin();
  const back = (message) => redirect(`/admin/newsletter?done=${encodeURIComponent(message)}`);
  const [last] = await db.lastNewsletters(1);
  if (last && Date.now() - new Date(last.sent_at).getTime() < 20 * 3600000 && !formData.get("again")) {
    back("Today's email was already sent. Tick “send again” if you really want to send another.");
  }
  const subscribers = await db.listSubscribers({ confirmed: true });
  if (!subscribers.length) back("Nobody has confirmed the daily email yet, so nothing was sent.");
  if (subscribers.length > FREE_DAILY_LIMIT) back(`You have ${subscribers.length} subscribers, more than the free ${FREE_DAILY_LIMIT} emails a day. Nothing was sent — ask Claude about a paid plan first.`);
  const stories = await topStories(db, 5);
  if (!stories.length) back("There are no published stories to send.");
  const day = formatDay();
  let sent = 0;
  const failures = [];
  for (let i = 0; i < subscribers.length; i += 5) {
    await Promise.all(
      subscribers.slice(i, i + 5).map(async (sub) => {
        try {
          await sendEmail({ to: sub.email, unsubscribe: sub.token, ...dailyEmail(stories, { lang: sub.lang, token: sub.token, day }) });
          sent++;
        } catch (err) {
          failures.push(err.message);
        }
      }),
    );
  }
  await db.logNewsletter({ subject: dailyEmail(stories, { lang: "en", token: "", day }).subject.slice(0, 300), recipients: sent });
  back(`Daily email sent to ${sent} of ${subscribers.length} readers${failures.length ? `. Problem: ${failures[0]}` : ""}`);
}

// ---- Facebook ----
export async function postFacebook(formData) {
  await requireAdmin();
  const story = await db.getStory(text(formData, "id", 60));
  if (story?.status !== "approved") refresh("published", "Only published stories can be posted to Facebook");
  if (story.facebook_post_id) refresh("published", "This story is already on your Facebook page");
  try {
    await shareOnFacebook(db, story);
    await logSocial(db, "Facebook", story);
  } catch (err) {
    await logSocial(db, "Facebook", story, err.message);
    refresh("published", err.message);
  }
  refresh("published", "Posted on your Facebook page");
}

// ---- Editors / reporters (admin only) ----
const backToEditors = (message) => redirect(`/admin/editors?done=${encodeURIComponent(message)}`);

export async function addEditor(formData) {
  await requireAdmin();
  const name = text(formData, "name", 80);
  const password = String(formData.get("password") || "");
  if (!name) backToEditors("Please write the person's name.");
  if (password.length < 10) backToEditors("The password must have at least 10 characters.");
  if (password === process.env.ADMIN_PASSWORD) backToEditors("Please choose a password different from your own.");
  const asked = String(formData.get("role"));
  const role = asked === SUB_EDITOR || asked === REPORTER ? asked : "editor";
  const saved = await db.createEditor({ name, password_hash: hashPassword(password), ...(role !== "editor" && { role }) }).then(() => true, () => false);
  if (!saved) backToEditors("Could not add them. If you chose Sub-editor or Reporter, first run supabase/sub-editors.sql in Supabase → SQL Editor.");
  backToEditors(`${name} can now sign in${role === "editor" ? "" : ` as a ${staffTitle({ role }).toLowerCase()}`}. Give them the password in person or by phone.`);
}

export async function changeEditor(formData) {
  await requireAdmin();
  const id = text(formData, "id", 60);
  const editor = await db.getEditor(id);
  if (!editor) backToEditors("That editor was not found.");
  const what = String(formData.get("what") || "");
  if (what === "remove") {
    await db.deleteEditor(id);
    backToEditors(`${editor.name} was removed and is signed out. Their stories stay on the website.`);
  }
  if (what === "photos") {
    // Switches whether this person may remove photos (the "Remove photo" button and removing gallery photos).
    const allowed = editor.can_delete === false;
    const saved = await db.updateEditor(id, { can_delete: allowed }).then(() => true, () => false);
    if (!saved) backToEditors("Could not change it. First run supabase/editor-controls.sql in Supabase → SQL Editor.");
    backToEditors(allowed ? `${editor.name} can now remove photos.` : `${editor.name} can no longer remove photos or gallery pictures.`);
  }
  if (what === "toggle") {
    await db.updateEditor(id, { active: !editor.active });
    backToEditors(editor.active ? `${editor.name} is paused and signed out.` : `${editor.name} can sign in again.`);
  }
  if (what === "password") {
    const password = String(formData.get("password") || "");
    if (password.length < 10) backToEditors("The new password must have at least 10 characters.");
    await db.updateEditor(id, { password_hash: hashPassword(password) });
    backToEditors(`New password saved for ${editor.name}.`);
  }
  if (what === "role") {
    const asked = String(formData.get("role"));
    const role = asked === SUB_EDITOR || asked === REPORTER ? asked : "editor";
    const saved = await db.updateEditor(id, { role }).then(() => true, () => false);
    if (!saved) backToEditors("Could not change it. First run supabase/sub-editors.sql in Supabase → SQL Editor.");
    backToEditors(role === "editor" ? `${editor.name} is now an editor: they can edit every story.` : `${editor.name} is now a ${staffTitle({ role }).toLowerCase()}: they see and edit only their own stories.`);
  }
  if (what === "rename") {
    const name = text(formData, "name", 80);
    if (!name) backToEditors("Please write a name.");
    await db.updateEditor(id, { name });
    backToEditors(`Name changed to ${name}. New stories will show this byline.`);
  }
  backToEditors("Nothing changed.");
}

// ---- Live broadcast (admin only) ----
export async function goLive(formData) {
  await requireAdmin();
  const back = (message) => redirect(`/admin/live?done=${encodeURIComponent(message)}`);
  const videoId = youtubeId(text(formData, "link", 300));
  const title = text(formData, "title", 150);
  if (!videoId) back("That is not a YouTube video or live link. Copy the link from the YouTube Share button.");
  if (!title) back("Please write a title, e.g. “Chief Minister's address on Statehood Day”.");
  await db.setSetting("live", {
    youtubeId: videoId,
    title,
    title_bn: text(formData, "title_bn", 200) || null,
    source: text(formData, "source", 80) || "YouTube",
    startedAt: new Date().toISOString(),
  });
  refreshPages();
  back("You are live: the broadcast is now on the front page and every page shows the LIVE strip.");
}

export async function endLive() {
  await requireAdmin();
  await db.setSetting("live", null);
  refreshPages();
  redirect(`/admin/live?done=${encodeURIComponent("Live broadcast ended and removed from the website.")}`);
}

// ---- Instagram ----
export async function postInstagram(formData) {
  await requireAdmin();
  const story = await db.getStory(text(formData, "id", 60));
  if (story?.status !== "approved") refresh("published", "Only published stories can be posted to Instagram");
  if (story.instagram_post_id) refresh("published", "This story is already on Instagram");
  try {
    await shareOnInstagram(db, story);
    await logSocial(db, "Instagram", story);
  } catch (err) {
    await logSocial(db, "Instagram", story, err.message);
    refresh("published", err.message);
  }
  refresh("published", "Posted on Instagram");
}

// ---- News Hunter drafts ----
// Drafts are never published by the Hunter itself: only APPROVE here turns one into a published story.
function backToHunter(notice, error = false) {
  redirect(`/admin/hunter?${error ? "error" : "done"}=${encodeURIComponent(notice)}`);
}

function hunterFields(formData) {
  return {
    headline: text(formData, "headline", 300),
    body: String(formData.get("body") || "").replace(/\r/g, "").trim().slice(0, 30000),
    state: regions.includes(formData.get("state")) ? formData.get("state") : regions[0],
  };
}

export async function saveHunterDraft(formData) {
  await requireAdmin();
  const id = text(formData, "id", 60);
  const fields = hunterFields(formData);
  if (!fields.headline || !fields.body) backToHunter("A draft needs a headline and text.", true);
  await hunterStore.updateDraft(id, fields);
  if (formData.get("andApprove")) return approveHunterDraft(formData);
  backToHunter("Draft saved");
}

// Saves the choice of proof screenshot, and whether it becomes the photo when the draft is published.
export async function setHunterPhoto(formData) {
  await requireAdmin();
  const id = text(formData, "id", 60);
  await hunterStore.updateDraft(id, { use_photo: formData.get("usePhoto") === "1", photo_index: Number(formData.get("photoIndex")) || 0 });
  backToHunter("Photo choice saved");
}

export async function approveHunterDraft(formData) {
  await requireAdmin();
  const draft = await hunterStore.getDraft(text(formData, "id", 60));
  if (!draft || draft.status !== "pending") backToHunter("This draft was already approved or rejected.", true);
  if (hasCheckMarks(draft.headline) || hasCheckMarks(draft.body)) {
    backToHunter("This draft still has [CHECK] or [DELETED POST] notes. Check those parts against the source, edit them, then approve.", true);
  }
  // The chosen proof screenshot becomes the photo, only if you switched it on for this draft.
  const shot = draft.use_photo ? draft.sources[draft.photo_index ?? 0] : null;
  const storyId = await publishHunterDraft({ db, hunterStore, draft, shot });
  illustrateLater(storyId);
  refreshPages();
  backToHunter("Published on the website");
}

// ---- Research desk ----
// Searches the internet for a topic and writes a draft (with your own notes), which waits in News Hunter.
export async function researchTopic(formData) {
  await requireAdmin();
  const topic = text(formData, "topic", 300);
  const notes = String(formData.get("notes") || "").trim().slice(0, 8000);
  // Each research uses the free Gemini allowance and fetches other websites.
  if (!(await rateLimit({ key: "research", limit: 20, windowSec: 3600 })).ok) redirect(`/admin/research?error=${encodeURIComponent("Too many researches in the last hour. Please wait a while.")}`);
  if (!topic) redirect(`/admin/research?error=${encodeURIComponent("Please write a topic.")}`);
  let failed = null;
  try {
    await researchAndDraft({ topic, notes, store: hunterStore, lessons: await loadLessons() });
  } catch (err) {
    failed = err.message;
  }
  if (failed) redirect(`/admin/research?error=${encodeURIComponent(`Could not finish: ${failed}`)}`);
  backToHunter(`Research draft ready: “${topic}”. Check it against the sources, then approve.`);
}

export async function rejectHunterDraft(formData) {
  await requireAdmin();
  await hunterStore.updateDraft(text(formData, "id", 60), { status: "rejected" });
  backToHunter("Draft rejected");
}

export async function restoreHunterDraft(formData) {
  await requireAdmin();
  await hunterStore.updateDraft(text(formData, "id", 60), { status: "pending" });
  backToHunter("Draft moved back to waiting");
}

// ---- Facebook / Instagram connection check ----
export async function checkSocialConnection() {
  await requireAdmin();
  const steps = await checkSocial(db);
  await db.setSetting("social_check", { at: new Date().toISOString(), steps });
  redirect("/admin/social");
}
