"use server";
// Server side of the thesis checker: only the academic editor's rewrite runs here, because it needs the site's AI
// key. The passage is sent to the AI provider for the edit and is not stored on the website.
import { currentUser } from "../../../lib/auth.js";
import { rateLimit } from "../../../lib/rate-limit.js";
import { editLikeAcademicEditor } from "../../../lib/academic-editor.js";

// Returns { ok: true, edited, notes, changes, mode } or { ok: false, error }.
export async function editThesisPassage(text, mode = "light") {
  const user = await currentUser();
  // The thesis is the owner's private work: only the admin account may use this tool.
  if (!user || user.role !== "admin") return { ok: false, error: "Please sign in again as the admin." };
  if (!(await rateLimit({ key: "academic-editor:admin", limit: 60, windowSec: 3600 })).ok) {
    return { ok: false, error: "You have used the academic editor 60 times in the last hour. Please wait a while." };
  }
  try {
    const result = await editLikeAcademicEditor(String(text || "").slice(0, 20000), { mode: mode === "thorough" ? "thorough" : "light" });
    return { ok: true, ...result };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
