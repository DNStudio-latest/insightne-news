// Free AI illustrations for published stories that have no photo, made with Cloudflare Workers AI (Flux).
// Needs CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN; without them nothing happens.
// Rules: always labelled, drawn style (not a fake photo), no real people, and never for sensitive stories.
import { sensitiveKeywordReasons } from "./text.js";

export const AI_CREDIT = "AI-generated illustration";
const MODEL = "@cf/black-forest-labs/flux-1-schnell";

// Stories about violence, crime, accidents, religion/community or rumours keep the plain category artwork:
// a made-up picture of such events would mislead readers.
const SENSITIVE = /violence|crime|accident|religion|community|rumou?r/i;

export function canIllustrate(story) {
  if (story.image_url) return false; // your own photo always wins
  const reasons = [...(story.check_reasons || []), ...sensitiveKeywordReasons(`${story.headline} ${story.summary || ""}`)];
  return !reasons.some((r) => SENSITIVE.test(r));
}

export function illustrationPrompt(story) {
  const place = ["India", "World", "Northeast"].includes(story.region) ? story.region === "Northeast" ? "Northeast India" : story.region : `${story.region}, Northeast India`;
  return [
    "Editorial illustration for a news website, flat vector art, soft natural colours, simple shapes, calm and neutral mood.",
    `Topic: ${story.headline}.`,
    `Setting: ${place}.`,
    "Show the general theme or setting only. No text, no letters, no numbers, no logos, no flags, no party symbols,",
    "no recognizable or realistic people, no faces in close-up, no weapons, no blood. Not a photograph.",
  ].join(" ");
}

export function illustrationsConfigured(env = process.env) {
  return Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_API_TOKEN);
}

export async function generateIllustration(story, { env = process.env, fetchFn = fetch } = {}) {
  const res = await fetchFn(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai/run/${MODEL}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ prompt: illustrationPrompt(story).slice(0, 2000), steps: 4 }),
    signal: AbortSignal.timeout(60000),
  });
  const data = await res.json().catch(() => ({}));
  const b64 = data?.result?.image || data?.image;
  if (!res.ok || !b64) throw new Error(`Cloudflare image error ${res.status}: ${JSON.stringify(data?.errors || data).slice(0, 200)}`);
  return Uint8Array.from(Buffer.from(b64, "base64"));
}

// Gives one story an illustration. Returns true when a picture was added.
export async function addIllustration(db, story, opts = {}) {
  if (!illustrationsConfigured(opts.env) || !canIllustrate(story)) return false;
  const bytes = await generateIllustration(story, opts);
  const image_url = await db.uploadImage(bytes, "image/jpeg");
  // Check again just before saving, in case you uploaded your own photo meanwhile.
  const fresh = await db.getStory(story.id);
  if (!fresh || fresh.image_url) return false;
  await db.updateStory(story.id, { image_url, image_caption: null, image_credit: AI_CREDIT });
  return true;
}

// Collector step: published stories from the last few days that still have no picture.
export async function addMissingIllustrations({ db, limit = 25, days = 3, log = console.log, ...opts }) {
  if (!illustrationsConfigured(opts.env)) return 0;
  const since = Date.now() - days * 86400000;
  const recent = (await db.listStories({ status: "approved", limit: 200 })).filter((s) => new Date(s.published_at).getTime() >= since);
  let added = 0;
  for (const story of recent.filter(canIllustrate).slice(0, limit)) {
    try {
      if (await addIllustration(db, story, opts)) added++;
    } catch (err) {
      log(`  ✗ No illustration for "${story.headline}": ${err.message}`);
    }
  }
  if (added) log(`  Added ${added} AI illustrations.`);
  return added;
}
