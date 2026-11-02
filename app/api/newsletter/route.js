// A reader asks for the daily email. We save the address and send a confirmation email;
// nothing else is sent until they click the link in it.
import { db } from "../../../lib/db.js";
import { validLang } from "../../../lib/languages.js";
import { cleanEmail, newToken, newsletterReady, confirmEmail, sendEmail } from "../../../lib/newsletter.js";
import { clientIp, rateLimit, tooMany } from "../../../lib/rate-limit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    // Each sign-up sends an email, so one visitor, and all visitors together, can only start a few per hour.
    if (!(await rateLimit({ key: `newsletter:${clientIp(request.headers)}`, limit: 8, windowSec: 3600 })).ok) return tooMany(3600);
    if (!(await rateLimit({ key: "newsletter:all", limit: 100, windowSec: 3600 })).ok) return tooMany(3600);
    if (!newsletterReady()) return Response.json({ error: "not ready" }, { status: 503 });
    const { email: raw, lang, website } = await request.json();
    if (website) return Response.json({ ok: true }); // a hidden box only robots fill in
    const email = cleanEmail(raw);
    if (!email) return Response.json({ error: "bad email" }, { status: 400 });
    const existing = await db.getSubscriber({ email });
    if (existing?.confirmed) return Response.json({ ok: true, already: true });
    // Don't send a new confirmation email more than once every 10 minutes to the same address.
    if (existing && Date.now() - new Date(existing.created_at).getTime() < 10 * 60000) return Response.json({ ok: true });
    const token = existing?.token || newToken();
    const language = validLang(lang);
    if (existing) await db.updateSubscriber(email, { created_at: new Date().toISOString(), lang: language });
    else await db.addSubscriber({ email, token, lang: language });
    await sendEmail({ to: email, ...confirmEmail(token, language) });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Newsletter sign-up failed:", err.message);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
