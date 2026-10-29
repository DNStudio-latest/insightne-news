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

test("Instagram: caption says link in bio; a story is posted once with the JPEG news card", async () => {
  const { instagramCaption, shareOnInstagram } = await import("../lib/instagram.js");
  process.env.FACEBOOK_PAGE_ID = "123";
  process.env.FACEBOOK_PAGE_TOKEN = "test-token";
  assert.match(instagramCaption(story), /^Roads open\n\nTwo roads reopened\.\n\n📰 Full story: link in bio · insightnenews\.in\n\n#ArunachalPradesh/);
  const realFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), body: options.body });
    if (String(url).includes("fields=instagram_business_account")) return Response.json({ instagram_business_account: { id: "ig1" } });
    if (String(url).endsWith("/ig1/media")) return Response.json({ id: "c1" });
    if (String(url).includes("/c1?")) return Response.json({ status_code: "FINISHED" });
    if (String(url).endsWith("/ig1/media_publish")) return Response.json({ id: "post9" });
    return Response.json({ error: { message: "unexpected" } }, { status: 400 });
  };
  const saved = {};
  try {
    assert.equal(await shareOnInstagram({ updateStory: async (id, f) => Object.assign(saved, f) }, { ...story, status: "approved" }), "post9");
  } finally {
    globalThis.fetch = realFetch;
  }
  const create = calls.find((c) => c.url.endsWith("/ig1/media"));
  assert.equal(create.body.get("image_url"), "https://www.insightnenews.in/card/roads-open-abc123?type=news&format=jpg");
  assert.equal(saved.instagram_post_id, "post9");
});
