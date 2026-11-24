// "Listen Top News": the day's headlines and summaries read aloud with an Azure Speech neural voice (free tier).
// Off until AZURE_SPEECH_KEY and AZURE_SPEECH_REGION are set on the server and listen.azureVoice is set in settings.json.
// Audio is kept in memory for an hour per text, so repeat visitors do not cost new generations.
import { createHash } from "node:crypto";
import { settings } from "./config.js";

const MAX_CHARS = 1800; // keeps each generation short and the cost predictable
const CACHE_MS = 60 * 60 * 1000;
const cache = new Map(); // hash -> { at, audio }

// Limits (rolling 24 hours). Plays past these limits get the device's own voice instead, so no Azure characters are used.
// Azure free tier: about 500,000 characters a month. At about 1,500 characters a read, 8 a day stays under it.
export const VISITOR_DAILY_LIMIT = settings.listen?.visitorDailyLimit ?? 5; // per visitor
export const SITE_DAILY_LIMIT = settings.listen?.siteDailyLimit ?? 8; // Azure generations for the whole site
export const DAY_SECONDS = 24 * 3600;

export function listenEnabled() {
  return Boolean(settings.listen?.enabled && settings.listen?.azureVoice && process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

const keyFor = (text) => createHash("sha256").update(`${settings.listen.azureVoice}\n${text}`).digest("hex");
const xml = (text) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

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

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-IN"><voice name="${settings.listen.azureVoice}">${xml(text)}</voice></speak>`;
  const res = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-96kbitrate-mono-mp3",
      "User-Agent": "insightne-listen",
    },
    body: ssml,
  });
  if (!res.ok) throw new Error(`Azure Speech returned ${res.status}`);
  const audio = Buffer.from(await res.arrayBuffer());

  if (cache.size >= 20) cache.clear();
  cache.set(key, { at: Date.now(), audio });
  return audio;
}
