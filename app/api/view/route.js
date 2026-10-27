// Counts one read of a story (used for "Most read"). No cookies, nothing about the reader is stored.
import { db } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { id } = await request.json();
    if (typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id)) {
      const story = await db.getStory(id);
      if (story?.status === "approved") await db.countView(id);
    }
  } catch {}
  return new Response(null, { status: 204 });
}
