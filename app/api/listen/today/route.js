// Audio of today's Top 5, read aloud (see lib/listen.js). Hidden (404) until it is switched on.
import { db } from "../../../../lib/db.js";
import { topStories } from "../../../../lib/top.js";
import { listenEnabled, buildListenScript, speak } from "../../../../lib/listen.js";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!listenEnabled()) return new Response("Listening is not switched on.", { status: 404 });
  try {
    const stories = await topStories(db);
    if (!stories.length) return new Response("No stories yet today.", { status: 404 });
    const audio = await speak(buildListenScript(stories));
    return new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "public, max-age=300" } });
  } catch (err) {
    console.error("listen:", err.message); // never log the key or the text
    return new Response("Audio is not available right now. Please try again later.", { status: 503 });
  }
}
