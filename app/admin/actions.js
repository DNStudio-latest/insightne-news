"use server";
// What happens when you press a button on the approval page.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "../../lib/db.js";
import { settings } from "../../lib/config.js";
import { isLoggedIn, passwordIsCorrect, startSession, endSession } from "../../lib/auth.js";

async function requireLogin() {
  if (!(await isLoggedIn())) redirect("/admin/login");
}

function refresh(view = "pending", notice = "") {
  revalidatePath("/", "layout");
  redirect(`/admin?view=${view}${notice ? `&done=${encodeURIComponent(notice)}` : ""}`);
}

function editedFields(formData) {
  const headline = String(formData.get("headline") || "").trim().slice(0, 200);
  const summary = String(formData.get("summary") || "").trim().slice(0, 1200);
  const region = settings.regions.includes(formData.get("region")) ? formData.get("region") : settings.regions[0];
  const topic = settings.topics.includes(formData.get("topic")) ? formData.get("topic") : null;
  if (!headline || !summary) throw new Error("Headline and summary cannot be empty.");
  return { headline, summary, region, topic };
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
  await db.updateStory(String(formData.get("id")), { status: "approved", published_at: new Date().toISOString() });
  refresh("pending", "Published");
}

export async function reject(formData) {
  await requireLogin();
  await db.updateStory(String(formData.get("id")), { status: "rejected", published_at: null });
  refresh("pending", "Rejected");
}

export async function saveEdit(formData) {
  await requireLogin();
  const fields = editedFields(formData);
  const id = String(formData.get("id"));
  if (formData.get("andApprove")) {
    await db.updateStory(id, { ...fields, status: "approved", published_at: new Date().toISOString() });
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
