"use server";
// Server side of the AI checker: the "senior news editor" rewrite needs the site's AI key, so it runs here.
import { currentUser } from "../../../lib/auth.js";
import { rateLimit } from "../../../lib/rate-limit.js";
import { editLikeSeniorEditor } from "../../../lib/news-editor.js";
import { loadLessons, addLesson } from "../../../lib/ai-lessons-store.js";

// Returns { ok: true, headline, body, notes, changes } or { ok: false, error }.
export async function editAsSeniorEditor(text) {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  // Each edit is a paid AI request: 30 an hour per person is plenty for a news desk.
  const who = user.id || user.role;
  if (!(await rateLimit({ key: `news-editor:${who}`, limit: 30, windowSec: 3600 })).ok) {
    return { ok: false, error: "You have used the editor 30 times in the last hour. Please wait a while." };
  }
  try {
    // The desk's approved lessons (Admin → Teach the AI) are part of the editor's instructions.
    const lessons = await loadLessons();
    const result = await editLikeSeniorEditor(String(text || "").slice(0, 20000), { lessons });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// "Teach the AI" from the checker page. Returns { ok: true, message } or { ok: false, error }.
export async function teachTheAi(input) {
  const user = await currentUser();
  if (!user) return { ok: false, error: "Please sign in again." };
  if (!(await rateLimit({ key: `ai-lessons:${user.id || user.role}`, limit: 30, windowSec: 3600 })).ok) {
    return { ok: false, error: "Too many lessons in the last hour. Please wait a while." };
  }
  const r = await addLesson(input || {}, user);
  if (!r.ok) return r;
  return {
    ok: true,
    message: r.lesson.status === "active"
      ? `Lesson saved and in use: the AI will avoid "${r.lesson.phrase}".`
      : `Lesson sent to the admin for approval: "${r.lesson.phrase}".`,
  };
}
