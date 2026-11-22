// Tells open pages the time of the newest published story (used for "New stories" button).
import { db } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET() {
  // Cached at the edge for 2 minutes: readers' "New stories" check does not need to be instant.
  return Response.json({ latest: await db.latestPublishedAt() }, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } });
}
