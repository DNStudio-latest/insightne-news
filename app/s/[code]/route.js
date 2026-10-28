// Short story links for WhatsApp messages: insightnenews.in/s/3defa2 → the full story page.
import { db } from "../../../lib/db.js";

export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { code } = await params;
  const story = /^[0-9a-f]{6}$/.test(code) ? await db.getStoryByCode(code).catch(() => null) : null;
  return Response.redirect(new URL(story ? `/story/${story.slug}` : "/", request.url), 308);
}
