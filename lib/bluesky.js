// Posts a published story to Bluesky: headline + hashtags, with a link card (title, summary, picture) that opens the story.
// Needs two secret settings: BLUESKY_HANDLE (e.g. insightne.bsky.social) and BLUESKY_APP_PASSWORD (an "app password" made in
// Bluesky > Settings > Privacy and security > App passwords; never the real password).
import { settings } from "./config.js";
import { hashtags, usePoster, posterUrl } from "./facebook.js";
import { readSocialLog } from "./social.js";

const PDS = "https://bsky.social/xrpc";
const MAX_TEXT = 300; // Bluesky allows 300 characters per post
const MAX_BLOB = 950000; // picture limit for link cards is 1 MB

export const blueskyReady = () => Boolean(process.env.BLUESKY_HANDLE && process.env.BLUESKY_APP_PASSWORD);
// autoPost in settings.json "bluesky": "originals" = only your own reports, true = every published story, false = off.
export function blueskyAutoPost(story) {
  const mode = settings.bluesky?.autoPost;
  if (!blueskyReady() || story?.status !== "approved") return false;
  return mode === true || (mode === "originals" && story.kind === "original");
}

const storyLink = (story) => new URL(`/story/${story.slug}`, settings.siteUrl).toString();

// Headline and hashtags, cut so the whole post fits in 300 characters.
export function blueskyText(story) {
  const tags = hashtags(story);
  const room = MAX_TEXT - tags.length - 2;
  let headline = String(story.headline || "").trim();
  if ([...headline].length > room) headline = `${[...headline].slice(0, Math.max(0, room - 1)).join("").trim()}…`;
  return tags ? `${headline}\n\n${tags}` : headline;
}

// Makes the #hashtags clickable. Bluesky counts positions in UTF-8 bytes.
export function hashtagFacets(text) {
  const enc = new TextEncoder();
  const facets = [];
  for (const m of text.matchAll(/#[A-Za-z0-9]+/g)) {
    const start = enc.encode(text.slice(0, m.index)).length;
    facets.push({
      index: { byteStart: start, byteEnd: start + enc.encode(m[0]).length },
      features: [{ $type: "app.bsky.richtext.facet#tag", tag: m[0].slice(1) }],
    });
  }
  return facets;
}

async function api(path, { token, body, headers = {}, fetchFn = fetch } = {}) {
  const res = await fetchFn(`${PDS}/${path}`, {
    method: "POST",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body,
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Bluesky said: ${data.message || data.error || res.status}`);
  return data;
}

async function uploadThumb(story, token, fetchFn) {
  const url = usePoster(story) ? posterUrl(story, "landscape") : story.image_url;
  if (!url) return null;
  try {
    const img = await fetchFn(new URL(url, settings.siteUrl), { signal: AbortSignal.timeout(30000) });
    if (!img.ok) return null;
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BLOB) return null; // a card without a picture is still fine
    const data = await api("com.atproto.repo.uploadBlob", { token, body: bytes, headers: { "content-type": img.headers.get("content-type") || "image/jpeg" }, fetchFn });
    return data.blob || null;
  } catch {
    return null;
  }
}

// Returns the post's address (at:// uri).
export async function postToBluesky(story, { fetchFn = fetch } = {}) {
  if (!blueskyReady()) throw new Error("Bluesky is not set up yet (BLUESKY_HANDLE or BLUESKY_APP_PASSWORD is missing).");
  const session = await api("com.atproto.server.createSession", {
    body: JSON.stringify({ identifier: process.env.BLUESKY_HANDLE, password: process.env.BLUESKY_APP_PASSWORD }),
    headers: { "content-type": "application/json" },
    fetchFn,
  });
  const text = blueskyText(story);
  const thumb = await uploadThumb(story, session.accessJwt, fetchFn);
  const record = {
    $type: "app.bsky.feed.post",
    text,
    facets: hashtagFacets(text),
    langs: ["en"],
    createdAt: new Date().toISOString(),
    embed: {
      $type: "app.bsky.embed.external",
      external: { uri: storyLink(story), title: String(story.headline || "").slice(0, 300), description: String(story.summary || "").slice(0, 300), ...(thumb ? { thumb } : {}) },
    },
  };
  const out = await api("com.atproto.repo.createRecord", {
    token: session.accessJwt,
    body: JSON.stringify({ repo: session.did, collection: "app.bsky.feed.post", record }),
    headers: { "content-type": "application/json" },
    fetchFn,
  });
  if (!out.uri) throw new Error("Bluesky said: no post address came back");
  return out.uri;
}

// True when this story already has a successful Bluesky post in the social log, so it is never posted twice.
export async function alreadyOnBluesky(db, story) {
  const log = await readSocialLog(db).catch(() => []);
  return log.some((e) => e.network === "Bluesky" && !e.error && e.slug === story.slug);
}
