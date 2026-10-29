// Posts a story's news-card picture with a caption to the Instagram account linked to your Facebook page.
// Uses the same page key as Facebook (FACEBOOK_PAGE_ID, FACEBOOK_PAGE_TOKEN); the key must also include the
// instagram_basic and instagram_content_publish permissions. Instagram links aren't clickable, so the caption
// says "link in bio".
import { settings } from "./config.js";
import { GRAPH, facebookReady, hashtags } from "./facebook.js";

export const instagramReady = () => facebookReady() && settings.instagram?.enabled === true;

// autoPost in settings.json: "originals" = only your own reports, true = every published story, false = only by button.
export function instagramAutoPost(story) {
  const mode = settings.instagram?.autoPost;
  if (!instagramReady() || story?.status !== "approved") return false;
  return mode === true || (mode === "originals" && story.kind === "original");
}

export function instagramCaption(story) {
  const site = settings.siteUrl.replace(/^https?:\/\/(www\.)?/, "");
  return [story.headline, "", story.summary, "", `📰 Full story: link in bio · ${site}`, "", hashtags(story)].join("\n").slice(0, 2200);
}

async function graph(path, params = {}, method = "GET") {
  const body = new URLSearchParams({ ...params, access_token: process.env.FACEBOOK_PAGE_TOKEN });
  const res = await fetch(method === "GET" ? `${GRAPH}/${path}?${body}` : `${GRAPH}/${path}`, {
    method,
    ...(method === "POST" && { headers: { "content-type": "application/x-www-form-urlencoded" }, body }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(`Instagram said: ${data.error?.message || res.status}`);
  return data;
}

// The Instagram account connected to the Facebook page (looked up once).
let accountId = null;
async function instagramAccount() {
  if (accountId) return accountId;
  const page = await graph(encodeURIComponent(process.env.FACEBOOK_PAGE_ID), { fields: "instagram_business_account" });
  if (!page.instagram_business_account?.id) {
    throw new Error("No Instagram account is linked to the Facebook page yet (Instagram must be a Professional account connected to the page).");
  }
  return (accountId = page.instagram_business_account.id);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Returns the Instagram post id.
export async function postToInstagram(story, { wait = 2000 } = {}) {
  if (!instagramReady()) throw new Error("Instagram posting is not switched on.");
  const ig = await instagramAccount();
  const type = story.is_breaking ? "breaking" : "news";
  const image_url = new URL(`/card/${story.slug}?type=${type}&format=jpg`, settings.siteUrl).toString();
  const { id: container } = await graph(`${ig}/media`, { image_url, caption: instagramCaption(story) }, "POST");
  // Instagram fetches the picture first; wait until it is ready (usually a few seconds).
  for (let i = 0; i < 10; i++) {
    const { status_code } = await graph(container, { fields: "status_code" });
    if (status_code === "FINISHED") break;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error("Instagram could not read the news card picture.");
    await sleep(wait);
  }
  const { id } = await graph(`${ig}/media_publish`, { creation_id: container }, "POST");
  return id;
}

// Posts once; remembers the post so the same story is never posted twice.
export async function shareOnInstagram(db, story) {
  if (story.instagram_post_id) return story.instagram_post_id;
  const id = await postToInstagram(story);
  await db.updateStory(story.id, { instagram_post_id: id, instagram_posted_at: new Date().toISOString() });
  return id;
}
