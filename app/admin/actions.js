"use server";
// What happens when you press a button on the approval page.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { addIllustration } from "../../lib/images.js";
import { sendAlert } from "../../lib/push.js";
import { shareOnFacebook, facebookAutoPost } from "../../lib/facebook.js";
import { sendEmail, dailyEmail, FREE_DAILY_LIMIT } from "../../lib/newsletter.js";
import { topStories } from "../../lib/top.js";
import { formatDay } from "../../lib/format.js";
import { db } from "../../lib/db.js";
import { settings, regions } from "../../lib/config.js";
import { currentRole, roleForPassword, startSession, endSession } from "../../lib/auth.js";

// Any signed-in person (admin or editor). Returns "admin" or "editor".
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

function refresh(view = "pending", notice = "") {
  revalidatePath("/", "layout");
  redirect(`/admin?view=${view}${notice ? `&done=${encodeURIComponent(notice)}` : ""}`);
}

// After a story is published, in the background: make its AI illustration (only if Cloudflare is set up),
// then post it to Facebook if "autoPost" is switched on in settings.json.
function illustrateLater(id) {
  after(async () => {
    try {
      const story = await db.getStory(id);
      if (story?.status === "approved" && (await addIllustration(db, story))) revalidatePath("/", "layout");
    } catch (err) {
      console.error("Illustration failed:", err.message);
    }
    try {
      const story = await db.getStory(id);
      if (facebookAutoPost() && story?.status === "approved") await shareOnFacebook(db, story);
    } catch (err) {
      console.error("Facebook post failed:", err.message);
    }
  });
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
  // A short pause makes guessing passwords very slow.
  await new Promise((r) => setTimeout(r, 800));
  const role = roleForPassword(String(formData.get("password") || ""));
  if (!role) redirect("/admin/login?wrong=1");
  await startSession(role);
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

// Photo, caption and credit from a form. Keeps the old photo unless a new one is chosen or "Remove photo" is tapped.
async function photoFields(formData, existing, onError) {
  const fields = {
    image_caption: text(formData, "image_caption", 300) || null,
    image_credit: text(formData, "image_credit", 120) || null,
    image_url: formData.get("removeImage") ? null : existing?.image_url || null,
  };
  const file = formData.get("image");
  if (file && typeof file === "object" && file.size > 0) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) onError("The photo must be a JPG, PNG or WEBP image.");
    if (file.size > 4 * 1024 * 1024) onError("The photo is too big (over 4 MB).");
    fields.image_url = await db.uploadImage(new Uint8Array(await file.arrayBuffer()), file.type);
  }
  return fields;
}

export async function saveEdit(formData) {
  const role = await requireLogin();
  const id = String(formData.get("id"));
  const view = String(formData.get("view") || "pending");
  const existing = await db.getStory(id);
  const fields = { ...editedFields(formData), ...(await photoFields(formData, existing, (message) => refresh(view, message))) };
  // If the English text changed, the Hindi/Assamese/Nepali versions are made again at the next collector run.
  if (fields.headline !== existing?.headline || fields.summary !== existing?.summary) fields.translations = {};
  if (formData.get("andApprove") && role === "admin") {
    await db.updateStory(id, { ...fields, status: "approved", published_at: new Date().toISOString() });
    illustrateLater(id);
    refresh("pending", "Saved and published");
  }
  await db.updateStory(id, fields);
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
  const id = text(formData, "id", 60);
  const existing = id ? await db.getStory(id) : null;
  // Editors publish their own stories directly when "editors.canPublish" is true in settings.json;
  // otherwise a new story from an editor waits in Pending for your approval.
  const canPublish = role === "admin" || settings.editors?.canPublish === true;
  const editorSends = !canPublish && formData.get("intent") === "publish" && existing?.status !== "approved";
  const publish = canPublish ? formData.get("intent") === "publish" || (role === "editor" && existing?.status === "approved") : existing?.status === "approved";
  const backToEditor = (message) => redirect(`/admin/write?${id ? `id=${id}&` : ""}error=${encodeURIComponent(message)}`);

  const fields = {
    kind: "original",
    headline: text(formData, "headline", 200),
    summary: text(formData, "summary", 600),
    body: String(formData.get("body") || "").trim().slice(0, 60000),
    region: regions.includes(formData.get("region")) ? formData.get("region") : regions[0],
    topic: settings.topics.includes(formData.get("topic")) ? formData.get("topic") : null,
    author: text(formData, "author", 120) || settings.defaultAuthor,
    headline_bn: text(formData, "headline_bn", 300) || null,
    summary_bn: text(formData, "summary_bn", 2000) || null,
    body_bn: String(formData.get("body_bn") || "").trim().slice(0, 60000) || null,
  };
  if (!fields.headline) backToEditor("Please write a headline.");
  if (existing && (fields.headline !== existing.headline || fields.summary !== existing.summary)) fields.translations = {};
  if (publish && (!fields.summary || !fields.body)) backToEditor("Please write the intro and the story text before publishing.");
  Object.assign(fields, await photoFields(formData, existing, backToEditor));

  // Gallery: keep the ticked photos, add the new ones (at most 20 in total).
  const keep = new Set(formData.getAll("keepGallery").map(String));
  const gallery = (existing?.gallery || []).filter((g) => keep.has(g.url));
  for (const file of formData.getAll("galleryFiles")) {
    if (!file || typeof file !== "object" || !file.size || gallery.length >= 20) continue;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 4 * 1024 * 1024) continue;
    gallery.push({ url: await db.uploadImage(new Uint8Array(await file.arrayBuffer()), file.type), caption: null });
  }
  fields.gallery = gallery;

  if (publish) {
    // Publishing from the editor is the editor's check, so the "needs check" note is cleared.
    Object.assign(fields, { status: "approved", published_at: existing?.published_at || new Date().toISOString(), needs_check: false, check_reasons: [] });
  } else {
    Object.assign(fields, { status: "pending", published_at: null });
  }

  let storyId = id;
  if (existing) await db.updateStory(id, fields);
  else storyId = await db.createStory({ ...fields, score: null, needs_check: false, check_reasons: [] });

  const wantsLead = role === "admin" ? Boolean(formData.get("is_lead")) : Boolean(existing?.is_lead);
  if (publish && wantsLead) await db.setLead(storyId);
  if (publish && !existing?.published_at) illustrateLater(storyId);
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
  revalidatePath("/", "layout");
  redirect(`/admin/polls?done=${encodeURIComponent("Poll is live on the front page")}`);
}

export async function togglePoll(formData) {
  await requireAdmin();
  const id = text(formData, "id", 60);
  const open = !formData.get("close");
  if (open) for (const p of await db.listPolls()) if (p.is_open) await db.updatePoll(p.id, { is_open: false });
  await db.updatePoll(id, { is_open: open });
  revalidatePath("/", "layout");
  redirect(`/admin/polls?done=${encodeURIComponent(open ? "Poll is back on the front page" : "Poll closed and taken off the front page")}`);
}

export async function deletePoll(formData) {
  await requireAdmin();
  await db.deletePoll(text(formData, "id", 60));
  revalidatePath("/", "layout");
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
  } catch (err) {
    refresh("published", err.message);
  }
  refresh("published", "Posted on your Facebook page");
}
