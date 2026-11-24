// "Listen to the Top 5": the day's headlines and summaries read aloud with an ElevenLabs voice.
// Off until the owner sets listen.voiceId in settings.json and ELEVENLABS_API_KEY in Vercel.
// Audio is kept in memory for an hour per text, so repeat visitors do not cost new generations.
import { createHash } from "node:crypto";
import { settings } from "./config.js";

const MAX_CHARS = 1800; // keeps each generation short and the cost predictable
const CACHE_MS = 60 * 60 * 1000;
const cache = new Map(); // hash -> { at, audio }

// Limits (rolling 24 hours). Plays past these limits get the device's own voice instead, so no ElevenLabs credits are used.
export const VISITOR_DAILY_LIMIT = 5; // per visitor
export const SITE_DAILY_LIMIT = 40; // ElevenLabs generations for the whole site
export const DAY_SECONDS = 24 * 3600;

export function listenEnabled() {
  return Boolean(settings.listen?.enabled && settings.listen?.voiceId && process.env.ELEVENLABS_API_KEY);
}

const keyFor = (text) => createHash("sha256").update(`${settings.listen.voiceId}\n${text}`).digest("hex");

// Audio already generated for this text in the last hour (costs nothing), or null.
export function cachedAudio(text) {
  const hit = cache.get(keyFor(text));
  return hit && Date.now() - hit.at < CACHE_MS ? hit.audio : null;
}

const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();

// Plain text for the narrator: an AI disclosure, then each story's headline and summary.
export function buildListenScript(stories, siteName = settings.siteName) {
  const parts = [`${siteName}. Top ${stories.length} news today. This audio is read by an AI voice.`];
  stories.forEach((s, i) => {
    parts.push(`Number ${i + 1}. ${clean(s.headline)}. ${clean(s.summary)}`);
  });
  const text = parts.join(" ");
  if (text.length <= MAX_CHARS) return text;
  const cut = text.slice(0, MAX_CHARS);
  const end = cut.lastIndexOf(". ");
  return end > 0 ? cut.slice(0, end + 1) : cut;
}

export async function speak(text) {
  const key = keyFor(text);
  const hit = cachedAudio(text);
  if (hit) return hit;

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(settings.listen.voiceId)}?output_format=mp3_44100_128`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: settings.listen.model || "eleven_multilingual_v2" }),
  });
  if (!res.ok) throw new Error(`ElevenLabs returned ${res.status}`);
  const audio = Buffer.from(await res.arrayBuffer());

  if (cache.size >= 20) cache.clear();
  cache.set(key, { at: Date.now(), audio });
  return audio;
}
