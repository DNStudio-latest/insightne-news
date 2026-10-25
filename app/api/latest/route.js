// Tells open pages the time of the newest published story (used for "New stories" button).
import { db } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ latest: await db.latestPublishedAt() }, { headers: { "Cache-Control": "no-store" } });
}
