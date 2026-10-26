// Automatic checks for the free Gemini summaries. A pretend Gemini answers, so nothing is sent to Google.
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "insightne-gemini-"));
process.env.LOCAL_DB_FILE = path.join(tmp, "db.json");
delete process.env.SUPABASE_URL;

const { db } = await import("../lib/db.js");
const { createGeminiAi } = await import("../lib/gemini.js");
const { createRulesAi } = await import("../lib/rules.js");
const { fillMissingSummaries } = await import("../lib/pipeline.js");

const states = ["Tripura", "Assam"];
const rules = createRulesAi({ topics: ["Politics"] });
const quiet = () => {};
const answer = {
  headline: "Free festive ration items reach Tripura shops",
  summary: "Food Minister Sushanta Chowdhury said semolina and flour have reached ration shops, with sugar due soon.",
  region: "Tripura",
  topic: "Politics",
  needs_extra_check: false,
  check_reasons: [],
};

function reply(status, body) {
  return { ok: status === 200, status, json: async () => body, text: async () => JSON.stringify(body) };
}

test("Gemini writes the headline and summary; the key goes in a header, not the address", async () => {
  const calls = [];
  const ai = createGeminiAi({
    rules, states, topics: ["Politics"], apiKey: "test-key", gapMs: 0, log: quiet,
    fetchFn: async (url, init) => {
      calls.push({ url, init });
      return reply(200, { candidates: [{ content: { parts: [{ text: "```json\n" + JSON.stringify(answer) + "\n```" }] } }] });
    },
  });
  const s = await ai.summarize([{ sourceName: "Paper", title: "Suji maida reach ration shops", snippet: "..." }]);
  assert.equal(s.headline, answer.headline);
  assert.equal(s.summary, answer.summary);
  assert.equal(s.region, "Tripura");
  assert.equal(s.topic, "Politics");
  assert.match(calls[0].url, /gemini-flash-lite-latest:generateContent$/);
  assert.ok(!calls[0].url.includes("test-key"));
  assert.equal(calls[0].init.headers["x-goog-api-key"], "test-key");
});

test("a busy answer (429) is retried; a lasting failure leaves the summary empty for the editor", async () => {
  let n = 0;
  const retrying = createGeminiAi({
    rules, states, apiKey: "k", gapMs: 0, log: quiet,
    fetchFn: async () => (++n === 1 ? reply(429, { error: { details: [{ retryDelay: "1s" }] } }) : reply(200, { candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] })),
  });
  assert.equal((await retrying.summarize([{ sourceName: "P", title: "Agartala news", snippet: "" }])).summary, answer.summary);
  assert.equal(n, 2);

  const broken = createGeminiAi({ rules, states, apiKey: "k", gapMs: 0, log: quiet, fetchFn: async () => reply(400, { error: "bad key" }) });
  const s = await broken.summarize([{ sourceName: "P", title: "Agartala news", snippet: "" }]);
  assert.equal(s.summary, "");
  assert.equal(s.headline, "Agartala news");
});

test("waiting stories without a summary get one; your own reports are left alone", async () => {
  const brief = await db.createStory({ headline: "Suji maida reach ration shops", summary: "", region: "Tripura", topic: null, score: 7, needs_check: false, check_reasons: [], status: "pending" },
    [{ source_name: "Paper", url: "https://example.com/r1", original_title: "Suji maida reach ration shops", snippet: "All shops" }]);
  const own = await db.createStory({ kind: "original", headline: "My report", summary: "", body: "", region: "Tripura", score: null, needs_check: false, check_reasons: [], status: "pending" });
  const ai = { summarize: async () => ({ headline: answer.headline, summary: answer.summary, region: "Tripura", topic: null, needsCheck: false, checkReasons: [] }) };
  assert.equal(await fillMissingSummaries({ db, ai, log: quiet }), 1);
  assert.equal((await db.getStory(brief)).summary, answer.summary);
  assert.equal((await db.getStory(brief)).headline, answer.headline);
  assert.equal((await db.getStory(own)).summary, "");
  assert.equal(await fillMissingSummaries({ db, ai: rules, log: quiet }), 0);
});
