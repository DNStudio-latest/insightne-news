import test from "node:test";
import assert from "node:assert/strict";
import { threadsText, postToThreads, threadsToken, threadsAutoPost, connectThreads, threadsAuthorizeUrl } from "../lib/threads.js";

const story = { status: "approved", kind: "original", slug: "a-story-abc123", headline: "Tripura minister opens a new bridge", summary: "A short summary.", region: "Tripura", topic: "Infrastructure" };
const fakeDb = () => {
  const store = {};
  return { store, getSetting: async (k) => store[k] ?? null, setSetting: async (k, v) => { store[k] = v; } };
};
const app = () => { process.env.THREADS_APP_ID = "app1"; process.env.THREADS_APP_SECRET = "secret1"; delete process.env.THREADS_USER_ID; delete process.env.THREADS_TOKEN; };

test("the text fits 500 characters, with the story link and one tag", () => {
  const text = threadsText({ ...story, headline: "x".repeat(900) });
  assert.ok([...text].length <= 500);
  assert.match(text, /\/story\/a-story-abc123/);
  assert.equal((text.match(/#/g) || []).length, 1);
});

test("the approval link asks for the two publishing permissions and returns to the callback", () => {
  app();
  const u = new URL(threadsAuthorizeUrl("abc"));
  assert.equal(u.searchParams.get("client_id"), "app1");
  assert.equal(u.searchParams.get("state"), "abc");
  assert.match(u.searchParams.get("scope"), /threads_content_publish/);
  assert.match(u.searchParams.get("redirect_uri"), /\/api\/threads\/callback$/);
});

test("connecting swaps the code for a long-lived token and saves it", async () => {
  app();
  const seen = [];
  const fetchFn = async (url, opts = {}) => {
    const u = String(url);
    seen.push(u);
    if (u.endsWith("/oauth/access_token")) return Response.json({ access_token: "short", user_id: 4242 });
    if (u.includes("th_exchange_token")) return Response.json({ access_token: "long", expires_in: 5184000 });
    return Response.json({ error: { message: "unexpected" } }, { status: 400 });
  };
  const db = fakeDb();
  const id = await connectThreads(db, "the-code", { fetchFn, now: 1000 });
  assert.equal(id, "4242");
  assert.deepEqual(db.store.threads_token, { userId: "4242", token: "long", at: 1000 });
});

test("creates a draft, waits until it is ready, publishes and returns the post id", async () => {
  app();
  const db = fakeDb();
  db.store.threads_token = { userId: "123", token: "saved-token", at: Date.now() };
  const calls = [];
  const fetchFn = async (url) => {
    const u = String(url);
    calls.push(u);
    if (u.endsWith("/threads")) return Response.json({ id: "container1" });
    if (u.includes("container1")) return Response.json({ status: "FINISHED" });
    if (u.endsWith("/threads_publish")) return Response.json({ id: "post99" });
    return Response.json({ error: { message: "unexpected " + u } }, { status: 400 });
  };
  const id = await postToThreads(db, story, { fetchFn, wait: async () => {} });
  assert.equal(id, "post99");
  assert.ok(calls.some((c) => c.endsWith("/v1.0/123/threads_publish")));
});

test("an old token is refreshed and the new one is saved", async () => {
  const db = fakeDb();
  const fetchFn = async () => Response.json({ access_token: "newer", expires_in: 5184000 });
  const t = await threadsToken(db, { userId: "123", token: "old", at: 0 }, { fetchFn, now: 30 * 86400000 });
  assert.equal(t, "newer");
  assert.equal(db.store.threads_token.token, "newer");
});

test("keeps using the current token when a refresh is refused", async () => {
  const fetchFn = async () => Response.json({ error: { message: "token too new" } }, { status: 400 });
  assert.equal(await threadsToken(fakeDb(), { userId: "1", token: "keep", at: null }, { fetchFn }), "keep");
});

test("a Threads error is reported in plain words", async () => {
  const db = fakeDb();
  db.store.threads_token = { userId: "123", token: "t", at: Date.now() };
  const fetchFn = async () => Response.json({ error: { message: "Invalid OAuth access token" } }, { status: 400 });
  await assert.rejects(() => postToThreads(db, story, { fetchFn, wait: async () => {} }), /Invalid OAuth access token/);
});

test("without a connection nothing is posted automatically", async () => {
  app();
  assert.equal(await threadsAutoPost(fakeDb(), story), false);
  const db = fakeDb();
  db.store.threads_token = { userId: "1", token: "t", at: 1 };
  assert.equal(await threadsAutoPost(db, story), true);
  assert.equal(await threadsAutoPost(db, { ...story, status: "pending" }), false);
});
