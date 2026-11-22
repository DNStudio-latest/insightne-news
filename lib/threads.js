// Posts a published story to Threads (Meta): the news poster (or a text post with the link), headline and a topic tag.
// Connect once from /admin/social ("CONNECT THREADS"): the site gets a Threads access token that lasts 60 days and
// refreshes it by itself. Needs THREADS_APP_ID and THREADS_APP_SECRET (the Threads app's id and secret) in the server file.
// Fallback for a hand-made token: THREADS_USER_ID and THREADS_TOKEN in the server file.
import { settings } from "./config.js";
import { hashtags, usePoster, posterUrl } from "./facebook.js";
import { readSocialLog } from "./social.js";

const BASE = "https://graph.threads.net";
const TOKEN_KEY = "threads_token";
const REFRESH_AFTER_MS = 20 * 86400000;
const MAX_TEXT = 500; // Threads allows 500 characters per post
export const THREADS_SCOPES = "threads_basic,threads_content_publish";

export const threadsAppReady = () => Boolean(process.env.THREADS_APP_ID && process.env.THREADS_APP_SECRET);
export const threadsRedirectUri = () => new URL("/api/threads/callback", settings.siteUrl).toString();

export function threadsAuthorizeUrl(state) {
  const q = new URLSearchParams({ client_id: process.env.THREADS_APP_ID, redirect_uri: threadsRedirectUri(), scope: THREADS_SCOPES, response_type: "code", state });
  return `https://threads.net/oauth/authorize?${q}`;
}

async function call(path, { method = "POST", params = {}, fetchFn = fetch } = {}) {
  const query = new URLSearchParams(params);
  const url = method === "GET" ? `${BASE}/${path}?${query}` : `${BASE}/${path}`;
  const res = await fetchFn(url, {
    method,
    ...(method === "GET" ? {} : { headers: { "content-type": "application/x-www-form-urlencoded" }, body: query }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error || data.error_message) throw new Error(`Threads said: ${data.error?.message || data.error_message || res.status}`);
  return data;
}

// After you approve on Threads: swaps the code for a long-lived token and saves it with the account id.
export async function connectThreads(db, code, { fetchFn = fetch, now = Date.now() } = {}) {
  const short = await call("oauth/access_token", {
    params: { client_id: process.env.THREADS_APP_ID, client_secret: process.env.THREADS_APP_SECRET, grant_type: "authorization_code", redirect_uri: threadsRedirectUri(), code },
    fetchFn,
  });
  if (!short.access_token || !short.user_id) throw new Error("Threads said: no access token came back");
  const long = await call("access_token", { method: "GET", params: { grant_type: "th_exchange_token", client_secret: process.env.THREADS_APP_SECRET, access_token: short.access_token }, fetchFn });
  const token = long.access_token || short.access_token;
  await db.setSetting(TOKEN_KEY, { userId: String(short.user_id), token, at: now });
  return String(short.user_id);
}

// The saved connection (from the button), or the hand-made one in the server file; null when neither exists.
export async function threadsConnection(db) {
  const saved = await db?.getSetting?.(TOKEN_KEY).catch(() => null);
  if (saved?.token && saved?.userId) return saved;
  if (process.env.THREADS_USER_ID && process.env.THREADS_TOKEN) return { userId: process.env.THREADS_USER_ID, token: process.env.THREADS_TOKEN, at: null };
  return null;
}

// autoPost in settings.json "threads": "originals" = only your own reports, true = every published story, false = off.
export async function threadsAutoPost(db, story) {
  const mode = settings.threads?.autoPost;
  if (story?.status !== "approved" || !(mode === true || (mode === "originals" && story.kind === "original"))) return false;
  return Boolean(await threadsConnection(db));
}

const storyLink = (story) => new URL(`/story/${story.slug}`, settings.siteUrl).toString();

// Headline, link and one topic tag (Threads uses a single tag per post), cut to fit 500 characters.
export function threadsText(story) {
  const tag = hashtags(story).split(" ")[0] || "";
  const tail = `\n\n${storyLink(story)}${tag ? `\n${tag}` : ""}`;
  const room = MAX_TEXT - tail.length;
  let head = String(story.headline || "").trim();
  if ([...head].length > room) head = `${[...head].slice(0, Math.max(0, room - 1)).join("").trim()}…`;
  return `${head}${tail}`;
}

// The token to use now, refreshed (and saved) every ~20 days; if a refresh is refused the current one is kept.
export async function threadsToken(db, conn, { fetchFn = fetch, now = Date.now() } = {}) {
  if (conn.at && now - conn.at < REFRESH_AFTER_MS) return conn.token;
  try {
    const data = await call("refresh_access_token", { method: "GET", params: { grant_type: "th_refresh_token", access_token: conn.token }, fetchFn });
    if (data.access_token) {
      await db?.setSetting?.(TOKEN_KEY, { userId: conn.userId, token: data.access_token, at: now }).catch(() => {});
      return data.access_token;
    }
  } catch (err) {
    console.error("Threads token not refreshed:", err.message);
  }
  return conn.token;
}

// Returns the Threads post id.
export async function postToThreads(db, story, { fetchFn = fetch, wait = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const conn = await threadsConnection(db);
  if (!conn) throw new Error("Threads is not connected yet (use CONNECT THREADS on /admin/social).");
  const access_token = await threadsToken(db, conn, { fetchFn });
  const user = encodeURIComponent(conn.userId);
  const text = threadsText(story);
  const withPicture = usePoster(story);
  const params = withPicture ? { media_type: "IMAGE", image_url: posterUrl(story, "landscape"), text, access_token } : { media_type: "TEXT", text, access_token };
  const container = await call(`v1.0/${user}/threads`, { params, fetchFn });
  if (!container.id) throw new Error("Threads said: no post draft came back");
  // Threads prepares the picture first; publish when it says FINISHED (up to ~60 seconds).
  for (let i = 0; i < 20; i++) {
    const s = await call(container.id, { method: "GET", params: { fields: "status,error_message", access_token }, fetchFn }).catch(() => ({}));
    if (s.status === "FINISHED" || (!withPicture && !s.status)) break;
    if (s.status === "ERROR" || s.status === "EXPIRED") throw new Error(`Threads said: ${s.error_message || s.status}`);
    await wait(3000);
  }
  const out = await call(`v1.0/${user}/threads_publish`, { params: { creation_id: container.id, access_token }, fetchFn });
  if (!out.id) throw new Error("Threads said: no post id came back");
  return out.id;
}

// True when this story already has a successful Threads post in the social log, so it is never posted twice.
export async function alreadyOnThreads(db, story) {
  const log = await readSocialLog(db).catch(() => []);
  return log.some((e) => e.network === "Threads" && !e.error && e.slug === story.slug);
}
