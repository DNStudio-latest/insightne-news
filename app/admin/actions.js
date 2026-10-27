"use server";
// What happens when you press a button on the approval page.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { addIllustration } from "../../lib/images.js";
import { db } from "../../lib/db.js";
import { settings, regions } from "../../lib/config.js";
import { isLoggedIn, passwordIsCorrect, startSession, endSession } from "../../lib/auth.js";

async function requireLogin() {
  if (!(await isLoggedIn())) redirect("/admin/login");
}

function refresh(view = "pending", notice = "") {
  revalidatePath("/", "layout");
  redirect(`/admin?view=${view}${notice ? `&done=${encodeURIComponent(notice)}` : ""}`);
}

// After a story is published, make its AI illustration in the background (only if Cloudflare is set up).
function illustrateLater(id) {
  after(async () => {
    try {
      const story = await db.getStory(id);
      if (story?.status === "approved" && (await addIllustration(db, story))) revalidatePath("/", "layout");
    } catch (err) {
      console.error("Illustration failed:", err.message);
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
  if (!passwordIsCorrect(String(formData.get("password") || ""))) redirect("/admin/login?wrong=1");
  await startSession();
  redirect("/admin");
}

export async function logout() {
  await endSession();
  redirect("/admin/login");
}

export async function approve(formData) {
  await requireLogin();
  const id = String(formData.get("id"));
  // Nothing goes on the website without a summary.
  const story = await db.getStory(id);
  if (!story?.summary?.trim()) refresh("pending", "Write a summary before approving (tap WRITE SUMMARY)");
  await db.updateStory(id, { status: "approved", published_at: new Date().toISOString() });
  illustrateLater(id);
  refresh("pending", "Published");
}

export async function reject(formData) {
  await requireLogin();
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
  await requireLogin();
  const id = String(formData.get("id"));
  const view = String(formData.get("view") || "pending");
  const fields = { ...editedFields(formData), ...(await photoFields(formData, await db.getStory(id), (message) => refresh(view, message))) };
  if (formData.get("andApprove")) {
    await db.updateStory(id, { ...fields, status: "approved", published_at: new Date().toISOString() });
    illustrateLater(id);
    refresh("pending", "Saved and published");
  }
  await db.updateStory(id, fields);
  refresh(String(formData.get("view") || "pending"), "Changes saved");
}

export async function unpublish(formData) {
  await requireLogin();
  await db.updateStory(String(formData.get("id")), { status: "pending", published_at: null });
  refresh("published", "Taken off the website and moved back to Pending");
}

export async function restore(formData) {
  await requireLogin();
  await db.updateStory(String(formData.get("id")), { status: "pending" });
  refresh("rejected", "Moved back to Pending");
}

export async function toggleBreaking(formData) {
  await requireLogin();
  const on = !formData.get("remove");
  await db.updateStory(String(formData.get("id")), { is_breaking: on });
  refresh("published", on ? "Breaking banner is on for this story (it switches off by itself after 12 hours)" : "Breaking banner switched off");
}

export async function makeLead(formData) {
  await requireLogin();
  const id = String(formData.get("id"));
  await db.setLead(formData.get("remove") ? null : id);
  refresh("published", formData.get("remove") ? "Removed as lead story" : "This is now the lead story on the front page");
}

const text = (formData, name, max) => String(formData.get(name) || "").trim().slice(0, max);

// Your own reports, written in the "Write a story" editor.
export async function saveOriginal(formData) {
  await requireLogin();
  const id = text(formData, "id", 60);
  const existing = id ? await db.getStory(id) : null;
  const publish = formData.get("intent") === "publish";
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
  if (publish && (!fields.summary || !fields.body)) backToEditor("Please write the intro and the story text before publishing.");
  Object.assign(fields, await photoFields(formData, existing, backToEditor));

  if (publish) {
    // Publishing from the editor is the editor's check, so the "needs check" note is cleared.
    Object.assign(fields, { status: "approved", published_at: existing?.published_at || new Date().toISOString(), needs_check: false, check_reasons: [] });
  } else {
    Object.assign(fields, { status: "pending", published_at: null });
  }

  let storyId = id;
  if (existing) await db.updateStory(id, fields);
  else storyId = await db.createStory({ ...fields, score: null, needs_check: false, check_reasons: [] });

  const wantsLead = Boolean(formData.get("is_lead"));
  if (publish && wantsLead) await db.setLead(storyId);
  else if (existing?.is_lead && (!wantsLead || !publish)) await db.setLead(null);

  refresh(publish ? "published" : "pending", publish ? "Your story is published" : "Draft saved — find it under Pending");
}
