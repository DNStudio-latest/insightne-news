import { test } from "node:test";
import assert from "node:assert/strict";
import { buildListenScript, listenEnabled } from "../lib/listen.js";

const story = (i, words = 20) => ({
  headline: `Headline ${i}  with   spaces`,
  summary: Array.from({ length: words }, () => "word").join(" ") + ".",
});

test("script starts with the AI disclosure and numbers each story", () => {
  const text = buildListenScript([story(1), story(2)], "InsightNE");
  assert.match(text, /^InsightNE\. Top 2 news today\. This audio is read by an AI voice\./);
  assert.match(text, /Number 1\. Headline 1 with spaces\./);
  assert.match(text, /Number 2\. Headline 2 with spaces\./);
});

test("long scripts are cut at a sentence end and stay under the limit", () => {
  const stories = Array.from({ length: 5 }, (_, i) => story(i + 1, 200));
  const text = buildListenScript(stories, "InsightNE");
  assert.ok(text.length <= 1800);
  assert.ok(text.endsWith("."));
});

test("listening stays off without a voice ID and API key", () => {
  delete process.env.ELEVENLABS_API_KEY;
  assert.equal(listenEnabled(), false);
});
