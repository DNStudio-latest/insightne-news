// Posts a published story to your Facebook page (headline, short summary and the link; Facebook shows the picture itself).
// Needs two secret settings: FACEBOOK_PAGE_ID and FACEBOOK_PAGE_TOKEN (see docs/5-FACEBOOK.md).
import { settings } from "./config.js";

export const GRAPH = "https://graph.facebook.com/v24.0";

export const facebookReady = () => Boolean(process.env.FACEBOOK_PAGE_ID && process.env.FACEBOOK_PAGE_TOKEN);
// autoPost in settings.json: "originals" = only your own reports, true = every published story, false = only by button.
export function facebookAutoPost(story) {
  const mode = settings.facebook?.autoPost;
  if (!facebookReady() || story?.status !== "approved") return false;
  return mode === true || (mode === "originals" && story.kind === "original");
}

// "#Tripura #NortheastIndia #InsightNE"
export const hashtags = (story) =>
  [story.region, story.topic, "Northeast India", "InsightNE"]
    .filter(Boolean)
    .map((t) => `#${t.split(/[^A-Za-z0-9]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("")}`)
    .filter((t, i, all) => all.indexOf(t) === i)
    .join(" ");

export function facebookMessage(story) {
  return [story.headline, "", story.summary, story.headline_bn ? `\n${story.headline_bn}` : "", "", hashtags(story)]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Returns the Facebook post id.
export async function postToFacebook(story) {
  if (!facebookReady()) throw new Error("Facebook is not set up yet (FACEBOOK_PAGE_ID or FACEBOOK_PAGE_TOKEN is missing).");
  const res = await fetch(`${GRAPH}/${encodeURIComponent(process.env.FACEBOOK_PAGE_ID)}/feed`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      message: facebookMessage(story),
      link: new URL(`/story/${story.slug}`, settings.siteUrl).toString(),
      access_token: process.env.FACEBOOK_PAGE_TOKEN,
    }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.id) throw new Error(`Facebook said: ${data.error?.message || res.status}`);
  return data.id;
}

// Posts once; remembers the post so the same story is never posted twice.
export async function shareOnFacebook(db, story) {
  if (story.facebook_post_id) return story.facebook_post_id;
  const id = await postToFacebook(story);
  await db.updateStory(story.id, { facebook_post_id: id, facebook_posted_at: new Date().toISOString() });
  return id;
}
