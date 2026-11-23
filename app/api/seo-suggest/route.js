// "Make search-friendly" for the admin editor, the iPhone desk and the desktop tool: any signed-in editor can ask for
// headline and description suggestions. Nothing is saved; the editor picks what to use.
import { currentRole } from "../../../lib/auth.js";
import { clientIp, rateLimit, tooMany } from "../../../lib/rate-limit.js";
import { suggestSeo } from "../../../lib/seo-assist.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request) {
  if (!(await currentRole())) return Response.json({ error: "Sign in first." }, { status: 403 });
  // The free Gemini limit is shared by everything on the site, so one person gets 40 requests an hour.
  const limit = await rateLimit({ key: `seo:${clientIp(request.headers)}`, limit: 40, windowSec: 3600 });
  if (!limit.ok) return tooMany(limit.retryAfter);
  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Send the headline, intro and story text." }, { status: 400 });
  }
  try {
    const out = await suggestSeo({ headline: String(input.headline || "").slice(0, 300), summary: String(input.summary || "").slice(0, 1200), body: String(input.body || ""), region: String(input.region || "").slice(0, 60) });
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return Response.json({ error: err.message || "Could not make suggestions." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
