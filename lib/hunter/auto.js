// Which News Hunter drafts may be published without the editor (settings: "autoPublish" in hunter.json).
// Anything the computer cannot fully check, or anything legally sensitive, always waits for you.
import crypto from "node:crypto";
import { hasCheckMarks } from "./checks.js";

export function autoPublishCheck(draft, rules = {}) {
  if (!rules.enabled) return { ok: false, reason: "auto-publish is switched off" };
  if (hasCheckMarks(draft.headline) || hasCheckMarks(draft.body)) return { ok: false, reason: "has [CHECK] notes" };
  if ((draft.flags || []).length) return { ok: false, reason: `flagged: ${draft.flags.join(", ")}` };
  if ((draft.score || 0) < (rules.minScore ?? 8)) return { ok: false, reason: `score ${draft.score} is below ${rules.minScore ?? 8}` };
  if ((draft.sources || []).some((s) => s.kind === "video")) return { ok: false, reason: "based on a video" };
  return { ok: true };
}

// The screenshot that may be shown as the story's photo: a web page (not a PDF notice, which often lists people's
// names, phone numbers or addresses). Sensitive drafts never reach here. Other screenshots stay private as proof.
export const safeShot = (draft) => (draft.sources || []).find((s) => s.proof && s.kind === "page") || null;

// A password made from the Supabase secret key, which both GitHub and Vercel already have. The key itself is never sent.
export const publishToken = (secret) => crypto.createHash("sha256").update(`hunter-publish:${secret}`).digest("hex");
export const PUBLISH_URL = "https://www.insightnenews.in/api/hunter-publish";

// Used by the Hunter on GitHub: asks the website to publish one draft. The website checks the rules again.
export function createPublisher({ secret = process.env.SUPABASE_SECRET_KEY, fetchFn = fetch } = {}) {
  if (!secret) return null;
  return async function publish(draftId) {
    const res = await fetchFn(PUBLISH_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${publishToken(secret)}`, "content-type": "application/json" },
      body: JSON.stringify({ draft: draftId }),
      signal: AbortSignal.timeout(60000),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.reason || `the website answered ${res.status}`);
    return out;
  };
}
