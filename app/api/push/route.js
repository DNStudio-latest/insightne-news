// A reader's browser signs up for (POST) or stops (DELETE) breaking-news alerts.
import { db } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

const validEndpoint = (e) => typeof e === "string" && e.startsWith("https://") && e.length < 1000;

export async function POST(request) {
  try {
    const { subscription, lang } = await request.json();
    const keys = subscription?.keys;
    if (!validEndpoint(subscription?.endpoint) || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") {
      return Response.json({ error: "bad subscription" }, { status: 400 });
    }
    await db.savePushSubscription({ endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh.slice(0, 200), auth: keys.auth.slice(0, 100) }, lang: lang === "bn" ? "bn" : "en" });
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
