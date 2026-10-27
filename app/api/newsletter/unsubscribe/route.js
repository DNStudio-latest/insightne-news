// One-click unsubscribe, used by the "Unsubscribe" button that Gmail and other email apps show.
import { db } from "../../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  const token = new URL(request.url).searchParams.get("t") || "";
  if (/^[0-9a-f]{48}$/.test(token)) {
    const sub = await db.getSubscriber({ token }).catch(() => null);
    if (sub) await db.deleteSubscriber(sub.email);
  }
  return new Response(null, { status: 204 });
}
