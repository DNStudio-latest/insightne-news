import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { settings } from "../lib/config.js";
import { postToFacebook, usePoster, posterUrl } from "../lib/facebook.js";
import { postsInLast24h, dailyLimit, readSocialLog } from "../lib/social.js";
import { finishPublishing } from "../lib/after-publish.js";

const story = { id: "s1", slug: "tripura-cabinet-plan-abc123", status: "approved", kind: "original", headline: "Cabinet approves plan", summary: "The Cabinet approved a plan.", region: "Tripura", image_url: "https://p/x.webp", image_credit: "InsightNE" };
const real = globalThis.fetch;
let calls;
const answer = (fn) => { globalThis.fetch = async (url, init) => { calls.push({ url: String(url), body: String(init?.body || "") }); return fn(String(url)); }; };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  calls = [];
  process.env.FACEBOOK_PAGE_ID = "123";
  process.env.FACEBOOK_PAGE_TOKEN = "test-token";
  settings.poster = { enabled: true, maxPerDay: 20 };
  settings.instagram = { ...(settings.instagram || {}), enabled: false };
  settings.facebook = { ...(settings.facebook || {}), autoPost: true };
});
afterEach(() => { globalThis.fetch = real; });

const memoryDb = (start = {}) => {
  const m = new Map(Object.entries(start));
  return { getSetting: async (k) => m.get(k), setSetting: async (k, v) => void m.set(k, v), getStory: async () => ({ ...story }), updateStory: async () => {}, _m: m };
};

test("a story with a photo is posted to Facebook as a poster with the story link in the caption", async () => {
  answer(() => json({ id: "9", post_id: "123_9" }));
  assert.equal(usePoster(story), true);
  assert.equal(await postToFacebook(story), "123_9");
  assert.match(calls[0].url, /\/123\/photos$/);
  const form = new URLSearchParams(calls[0].body);
  assert.equal(form.get("url"), posterUrl(story));
  assert.match(form.get("caption"), /Full story: https:\/\/www\.insightnenews\.in\/story\/tripura-cabinet-plan-abc123/);
});

test("if the poster cannot be posted, the story is still shared as a link post", async () => {
  answer((url) => (url.endsWith("/photos") ? json({ error: { message: "could not fetch image" } }, 400) : json({ id: "55" })));
  assert.equal(await postToFacebook(story), "55");
  assert.deepEqual(calls.map((c) => c.url.split("/").pop()), ["photos", "feed"]);
});

test("stories without a photo, and posters switched off, use the plain link post", async () => {
  answer(() => json({ id: "77" }));
  assert.equal(usePoster({ ...story, image_url: null }), false);
  assert.equal(await postToFacebook({ ...story, image_url: null }), "77");
  settings.poster.enabled = false;
  assert.equal(usePoster(story), false);
});

test("the daily limit counts only successful posts of the last 24 hours on that network", async () => {
  const now = Date.now();
  const iso = (hoursAgo) => new Date(now - hoursAgo * 3600000).toISOString();
  const db = memoryDb({ social_log: { entries: [
    { at: iso(1), network: "Facebook", error: null },
    { at: iso(5), network: "Facebook", error: null },
    { at: iso(30), network: "Facebook", error: null }, // too old
    { at: iso(2), network: "Facebook", error: "failed" }, // did not work
    { at: iso(2), network: "Instagram", error: null }, // another network
  ] } });
  assert.equal(await postsInLast24h(db, "Facebook", now), 2);
  assert.equal(dailyLimit(), 20);
  settings.poster.maxPerDay = 0;
  assert.equal(dailyLimit(), 20); // an invalid value falls back to the default
});

test("after publishing, a story is posted while under the limit and skipped, with a note, once the limit is reached", async () => {
  answer(() => json({ post_id: "1_1", id: "1" }));
  settings.poster.maxPerDay = 1;
  const db = memoryDb();
  await finishPublishing(db, "s1");
  assert.equal(calls.length, 1, "first story is posted");
  await finishPublishing(db, "s1");
  assert.equal(calls.length, 1, "second story is not posted: the limit of 1 is reached");
  const log = await readSocialLog(db);
  assert.equal(log[0].network, "Facebook");
  assert.match(log[0].error, /Daily limit of 1/);
});
