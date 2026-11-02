// A reader's browser signs up for (POST) or stops (DELETE) breaking-news alerts.
import { db } from "../../../lib/db.js";
import { validLang } from "../../../lib/languages.js";
import { isPushServiceUrl } from "../../../lib/push-hosts.js";
import { clientIp, rateLimit, tooMany } from "../../../lib/rate-limit.js";

export const dynamic = "force-dynamic";

// Only the browser makers' own push services (lib/push-hosts.js): our server sends a message to this address.
const validEndpoint = (e) => typeof e === "string" && e.length < 1000 && isPushServiceUrl(e);

export async function POST(request) {
  try {
    if (!(await rateLimit({ key: `push:${clientIp(request.headers)}`, limit: 20, windowSec: 3600 })).ok) return tooMany(3600);
    const { subscription, lang } = await request.json();
    const keys = subscription?.keys;
    if (!validEndpoint(subscription?.endpoint) || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
      return Response.json({ error: "bad subscription" }, { status: 400 });
    }
    await db.savePushSubscription({ endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh.slice(0, 200), auth: keys.auth.slice(0, 100) }, lang: validLang(lang) });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { endpoint } = await request.json();
    if (validEndpoint(endpoint)) await db.deletePushSubscription(endpoint);
  } catch {}
  return new Response(null, { status: 204 });
}
