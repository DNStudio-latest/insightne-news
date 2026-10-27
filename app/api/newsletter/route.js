// A reader asks for the daily email. We save the address and send a confirmation email;
// nothing else is sent until they click the link in it.
import { db } from "../../../lib/db.js";
import { cleanEmail, newToken, newsletterReady, confirmEmail, sendEmail } from "../../../lib/newsletter.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
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
    const language = lang === "bn" ? "bn" : "en";
    if (existing) await db.updateSubscriber(email, { created_at: new Date().toISOString(), lang: language });
    else await db.addSubscriber({ email, token, lang: language });
    await sendEmail({ to: email, ...confirmEmail(token, language) });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("Newsletter sign-up failed:", err.message);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
