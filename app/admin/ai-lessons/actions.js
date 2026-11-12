"use server";
// Admin → Teach the AI: staff suggest lessons, the admin approves, switches off or deletes them.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { currentUser } from "../../../lib/auth.js";
import { rateLimit } from "../../../lib/rate-limit.js";
import { addLesson, decideLesson } from "../../../lib/ai-lessons-store.js";
import { dismissSuggestion } from "../../../lib/lesson-suggestions.js";

const back = (key, message) => redirect(`/admin/ai-lessons?${key}=${encodeURIComponent(message)}`);

export async function suggestLesson(formData) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  if (!(await rateLimit({ key: `ai-lessons:${user.id || user.role}`, limit: 30, windowSec: 3600 })).ok) back("error", "Too many lessons in the last hour. Please wait a while.");
  const r = await addLesson(
    { phrase: formData.get("phrase"), better: formData.get("better"), why: formData.get("why"), tools: formData.getAll("tools").map(String) },
    user,
  );
  if (!r.ok) back("error", r.error);
  revalidatePath("/admin/ai-lessons");
  back("done", r.lesson.status === "active" ? `Lesson in use: "${r.lesson.phrase}"` : `Lesson sent to the admin for approval: "${r.lesson.phrase}"`);
}

export async function dismiss(formData) {
  const user = await currentUser();
  if (user?.role !== "admin") redirect("/admin/login");
  await dismissSuggestion(String(formData.get("key") || "").slice(0, 200));
  revalidatePath("/admin/ai-lessons");
  back("done", "Suggestion dismissed");
}

export async function decide(formData) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  const op = String(formData.get("op") || "");
  const r = await decideLesson(String(formData.get("id") || "").slice(0, 60), op, user);
  if (!r.ok) back("error", r.error);
  revalidatePath("/admin/ai-lessons");
  back("done", { approve: "Lesson approved: the AI uses it from now on", on: "Lesson switched on", off: "Lesson switched off", delete: "Lesson deleted" }[op]);
}
