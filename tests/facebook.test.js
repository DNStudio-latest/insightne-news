import { test } from "node:test";
import assert from "node:assert/strict";
import { facebookMessage, shareOnFacebook } from "../lib/facebook.js";

const story = { id: "s1", slug: "roads-open-abc123", headline: "Roads open", summary: "Two roads reopened.", region: "Arunachal Pradesh", topic: "Politics" };

test("Facebook message has the headline, summary and hashtags", () => {
  const msg = facebookMessage(story);
  assert.match(msg, /^Roads open\n\nTwo roads reopened\./);
  assert.match(msg, /#ArunachalPradesh #Politics #NortheastIndia #InsightNE$/);
});

test("a story is posted once and the post is remembered", async () => {
  process.env.FACEBOOK_PAGE_ID = "123";
  process.env.FACEBOOK_PAGE_TOKEN = "test-token";
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => (calls.push({ url, body: options.body }), Response.json({ id: "123_456" }));
  const saved = {};
  const db = { updateStory: async (id, fields) => Object.assign(saved, fields) };
  try {
    assert.equal(await shareOnFacebook(db, story), "123_456");
    assert.equal(await shareOnFacebook(db, { ...story, facebook_post_id: "123_456" }), "123_456");
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /graph\.facebook\.com\/v\d+\.0\/123\/feed$/);
  assert.equal(calls[0].body.get("link"), "https://www.insightnenews.in/story/roads-open-abc123");
  assert.equal(saved.facebook_post_id, "123_456");
});

test("only your own published reports are posted automatically", async () => {
  const { facebookAutoPost } = await import("../lib/facebook.js");
  process.env.FACEBOOK_PAGE_ID = "123";
  process.env.FACEBOOK_PAGE_TOKEN = "test-token";
  assert.equal(facebookAutoPost({ status: "approved", kind: "original" }), true);
  assert.equal(facebookAutoPost({ status: "approved", kind: "brief" }), false, "news briefs wait for the button");
  assert.equal(facebookAutoPost({ status: "pending", kind: "original" }), false, "drafts are never posted");
  delete process.env.FACEBOOK_PAGE_TOKEN;
  assert.equal(facebookAutoPost({ status: "approved", kind: "original" }), false, "nothing happens without the page key");
});
