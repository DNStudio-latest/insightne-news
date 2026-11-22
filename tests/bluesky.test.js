import test from "node:test";
import assert from "node:assert/strict";
import { blueskyText, hashtagFacets, postToBluesky, blueskyAutoPost } from "../lib/bluesky.js";

const story = { status: "approved", kind: "original", slug: "a-story-abc123", headline: "Tripura minister opens a new bridge", summary: "A short summary.", region: "Tripura", topic: "Infrastructure" };

test("the post text fits in 300 characters and keeps the hashtags", () => {
  const long = { ...story, headline: "x".repeat(500) };
  const text = blueskyText(long);
  assert.ok([...text].length <= 300);
  assert.match(text, /#Tripura/);
});

test("hashtag positions are counted in bytes", () => {
  const text = "Café news\n\n#Tripura #InsightNE";
  const [a] = hashtagFacets(text);
  const bytes = new TextEncoder().encode(text);
  assert.equal(new TextDecoder().decode(bytes.slice(a.index.byteStart, a.index.byteEnd)), "#Tripura");
  assert.equal(a.features[0].tag, "Tripura");
});

test("posts with a link card and returns the post address", async () => {
  process.env.BLUESKY_HANDLE = "insightne.bsky.social";
  process.env.BLUESKY_APP_PASSWORD = "test-app-password";
  const calls = [];
  const fetchFn = async (url, opts = {}) => {
    calls.push({ url: String(url), body: opts.body });
    const u = String(url);
    if (u.endsWith("createSession")) return Response.json({ accessJwt: "jwt", did: "did:plc:abc" });
    if (u.endsWith("createRecord")) return Response.json({ uri: "at://did:plc:abc/app.bsky.feed.post/1" });
    return new Response("no picture", { status: 404 });
  };
  const uri = await postToBluesky(story, { fetchFn });
  assert.equal(uri, "at://did:plc:abc/app.bsky.feed.post/1");
  const record = JSON.parse(calls.find((c) => c.url.endsWith("createRecord")).body).record;
  assert.equal(record.embed.external.uri, "https://www.insightnenews.in/story/a-story-abc123");
  assert.equal(record.text.includes("Tripura minister"), true);
});

test("auto-post needs the keys and a published story", () => {
  process.env.BLUESKY_HANDLE = "insightne.bsky.social";
  process.env.BLUESKY_APP_PASSWORD = "x";
  assert.equal(blueskyAutoPost(story), true);
  assert.equal(blueskyAutoPost({ ...story, status: "pending" }), false);
  delete process.env.BLUESKY_APP_PASSWORD;
  assert.equal(blueskyAutoPost(story), false);
});
