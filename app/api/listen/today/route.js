// Audio of today's Top 5, read aloud (see lib/listen.js). Hidden (404) until it is switched on.
// Azure Speech is called only when a visitor presses Listen and the audio is not already cached. Past the limits,
// the route answers with the text so the browser can read it with the device's own voice.
import { db } from "../../../../lib/db.js";
import { topStories } from "../../../../lib/top.js";
import { rateLimit, clientIp } from "../../../../lib/rate-limit.js";
import {
  listenEnabled,
  buildListenScript,
  speak,
  cachedAudio,
  VISITOR_DAILY_LIMIT,
  SITE_DAILY_LIMIT,
  DAY_SECONDS,
} from "../../../../lib/listen.js";

export const dynamic = "force-dynamic";

const audioResponse = (audio) =>
  new Response(audio, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });

export async function GET(request) {
  if (!listenEnabled()) return new Response("Listening is not switched on.", { status: 404 });
  try {
    const stories = await topStories(db);
    if (!stories.length) return new Response("No stories yet today.", { status: 404 });
    const text = buildListenScript(stories);

    // Every press counts against the visitor, whether or not the audio is already cached.
    const visitor = await rateLimit({ key: `listen:visitor:${clientIp(request.headers)}`, limit: VISITOR_DAILY_LIMIT, windowSec: DAY_SECONDS });
    if (!visitor.ok) return Response.json({ fallback: true, text });

    const cached = cachedAudio(text);
    if (cached) return audioResponse(cached);

    // Only a real Azure generation counts against the site's daily total.
    const site = await rateLimit({ key: "listen:site", limit: SITE_DAILY_LIMIT, windowSec: DAY_SECONDS });
    if (!site.ok) return Response.json({ fallback: true, text });

    return audioResponse(await speak(text));
  } catch (err) {
    console.error("listen:", err.message); // never log the key or the text
    return new Response("Audio is not available right now. Please try again later.", { status: 503 });
  }
}
