// Keeps a short record of automatic Facebook / Instagram posts (so a failure is visible on /admin/social),
// and checks the connection step by step to find the exact problem.
import { settings } from "./config.js";
import { GRAPH, facebookReady } from "./facebook.js";

const LOG_KEY = "social_log";
const LOG_SIZE = 20;

export async function readSocialLog(db) {
  return (await db.getSetting(LOG_KEY).catch(() => null))?.entries ?? [];
}

// network: "Facebook" | "Instagram"; error: the message, or null when it worked.
export async function logSocial(db, network, story, error = null) {
  try {
    const entries = await readSocialLog(db);
    entries.unshift({ at: new Date().toISOString(), network, headline: story.headline, slug: story.slug, error });
    await db.setSetting(LOG_KEY, { entries: entries.slice(0, LOG_SIZE) });
  } catch (err) {
    console.error("Could not save the social log:", err.message);
  }
}

async function graph(path, params = {}) {
  const query = new URLSearchParams({ ...params, access_token: process.env.FACEBOOK_PAGE_TOKEN });
  const res = await fetch(`${GRAPH}/${path}?${query}`, { signal: AbortSignal.timeout(15000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data.error?.message || `error ${res.status}`);
  return data;
}

// Returns [{ ok: true | false, text }] — one line per step, stopping where it breaks.
export async function checkSocial(db) {
  const steps = [];
  const add = (ok, text) => steps.push({ ok, text });

  if (!process.env.FACEBOOK_PAGE_ID) add(false, "FACEBOOK_PAGE_ID is missing in Vercel → Settings → Environment Variables.");
  if (!process.env.FACEBOOK_PAGE_TOKEN) add(false, "FACEBOOK_PAGE_TOKEN is missing in Vercel → Settings → Environment Variables.");
  if (!facebookReady()) return steps;
  add(true, "Both Facebook keys are in Vercel.");

  // A page key answers /me with the page itself; a personal key answers with your own profile.
  let me;
  try {
    me = await graph("me", { fields: "id,name" });
  } catch (err) {
    add(false, `Facebook refused the key: ${err.message} → Make a new page key (guide 5, step 2) and replace FACEBOOK_PAGE_TOKEN in Vercel, then Redeploy.`);
    return steps;
  }
  if (me.id !== process.env.FACEBOOK_PAGE_ID) {
    add(false, `The key belongs to "${me.name}" (id ${me.id}), not to the page id in FACEBOOK_PAGE_ID (${process.env.FACEBOOK_PAGE_ID}). Use the page's own access_token from me/accounts (guide 5, step 2.5–2.6), or fix the page id.`);
    return steps;
  }
  add(true, `The key is the page key for "${me.name}".`);

  const autoFb = settings.facebook?.autoPost;
  add(autoFb !== false, autoFb === true ? "Facebook auto-post: every published story." : autoFb === "originals" ? "Facebook auto-post: only your own reports (news briefs need the POST TO FACEBOOK button)." : "Facebook auto-post is switched off in settings.");

  if (settings.instagram?.enabled !== true) {
    add(false, "Instagram is switched off in settings (instagram.enabled).");
    return steps;
  }
  let page;
  try {
    page = await graph(encodeURIComponent(process.env.FACEBOOK_PAGE_ID), { fields: "instagram_business_account{id,username}" });
  } catch (err) {
    add(false, `Could not ask Facebook for the linked Instagram account: ${err.message} → The page key needs the instagram_basic and instagram_content_publish permissions; make a new key with them.`);
    return steps;
  }
  const ig = page.instagram_business_account;
  if (!ig?.id) {
    add(false, "No Instagram account is linked to the Facebook page. In the Instagram app: Settings → Account type → switch to Professional, then link it to the InsightNE News Facebook page (Facebook page → Settings → Linked accounts → Instagram).");
    return steps;
  }
  add(true, `Instagram account linked: @${ig.username || ig.id}.`);

  try {
    await graph(`${ig.id}/content_publishing_limit`, { fields: "quota_usage" });
    add(true, "The key is allowed to publish on Instagram.");
  } catch (err) {
    add(false, `The key cannot publish on Instagram: ${err.message} → Make a new page key that includes instagram_basic and instagram_content_publish.`);
  }

  // Instagram downloads the news-card picture from the website, so it must be a public JPEG.
  const [latest] = await db.listStories({ status: "approved", limit: 1 }).catch(() => []);
  if (latest?.slug) {
    const url = new URL(`/card/${latest.slug}?type=news&format=jpg`, settings.siteUrl).toString();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
      const type = res.headers.get("content-type") || "";
      add(res.ok && type.includes("jpeg"), res.ok && type.includes("jpeg") ? "The news-card picture opens as a JPEG." : `The news-card picture did not load properly (${res.status}, ${type || "no type"}): ${url}`);
    } catch (err) {
      add(false, `The news-card picture did not load: ${err.message} (${url})`);
    }
  }
  const autoIg = settings.instagram?.autoPost;
  add(autoIg !== false, autoIg === true ? "Instagram auto-post: every published story." : autoIg === "originals" ? "Instagram auto-post: only your own reports (news briefs need the POST TO INSTAGRAM button)." : "Instagram auto-post is switched off in settings.");
  return steps;
}
