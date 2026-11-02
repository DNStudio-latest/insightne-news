// Counts one read of a story (used for "Most read"). No cookies, nothing about the reader is stored.
import { db } from "../../../lib/db.js";
import { clientIp, rateLimit } from "../../../lib/rate-limit.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    // Kept in memory only: this runs on every story read, and a reader opens a few hundred stories an hour at most.
    if (!(await rateLimit({ key: `view:${clientIp(request.headers)}`, limit: 300, windowSec: 3600, durable: false })).ok) return new Response(null, { status: 204 });
    const { id } = await request.json();
    if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) {
      const story = await db.getStory(id);
      if (story?.status === "approved") await db.countView(id);
    }
  } catch {}
  return new Response(null, { status: 204 });
}
