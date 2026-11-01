import { test } from "node:test";
import assert from "node:assert/strict";
import { searchTopic, newsSearch, researchAndDraft } from "../lib/research.js";

// A Gemini answer with Google Search results, like the real one.
const searchReply = {
  candidates: [
    {
      content: { parts: [{ text: "The State Election Commission, Tripura announced on October 30, 2026 that polling for 21 urban local bodies will be held on November 27, 2026 (Tripura Times, October 30). Counting is on December 2." }] },
      groundingMetadata: {
        webSearchQueries: ["Tripura municipal election 2026"],
        groundingChunks: [
          { web: { title: "sec.tripura.gov.in", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc" } },
          { web: { title: "tripuratimes.com", uri: "https://tripuratimes.com/poll" } },
          { web: { title: "sec.tripura.gov.in again", uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc" } },
        ],
      },
    },
  ],
};

// Bing News feed, like the real one (the link is Bing's click link holding the real address).
const bingFeed = `<rss><channel>
<item><title>Tripura civic polls for 21 urban local bodies set for November 27</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;url=https%3a%2f%2fwww.indiatoday.in%2felections%2ftripura-civic&amp;mkt=en-in</link><description>Elections to 21 urban local bodies in Tripura will be held on November 27 ...</description><pubDate>Fri, 30 Oct 2026 09:21:00 GMT</pubDate><News:Source>India Today</News:Source></item>
<item><title>BJP, Tipra Motha to contest civic polls together</title><link>http://www.bing.com/news/apiclick.aspx?url=https%3a%2f%2fnenow.in%2ftripura-civic</link><description>The two parties will contest together.</description><pubDate>Sun, 01 Nov 2026 05:00:00 GMT</pubDate><News:Source>Northeast Now</News:Source></item>
</channel></rss>`;

const makeFetch = ({ googleStatus = 200 } = {}) => async (url, init = {}) => {
  if (url.includes("generateContent")) {
    assert.deepEqual(JSON.parse(init.body).tools, [{ google_search: {} }], "searches Google");
    if (googleStatus !== 200) return new Response(JSON.stringify({ error: { message: "Quota exceeded for grounding" } }), { status: googleStatus });
    return new Response(JSON.stringify(searchReply), { status: 200 });
  }
  if (url.includes("grounding-api-redirect")) return new Response(null, { status: 302, headers: { location: "https://sec.tripura.gov.in/schedule" } });
  if (url.startsWith("https://www.bing.com/news/search")) return new Response(bingFeed, { status: 200 });
  throw new Error(`unexpected ${url}`);
};

// Reading a report: India Today's page can be read, Northeast Now refuses.
const get = async (url) =>
  url.includes("indiatoday")
    ? { ok: true, url, text: `<article><h1>Tripura civic polls</h1><p>${"Polling for 21 urban local bodies in Tripura will be held on November 27, 2026, the State Election Commission said. ".repeat(5)}</p></article>` }
    : { ok: false, reason: "robots.txt says no" };

const writer = (capture) => async (system, content) => {
  capture.content = content;
  return JSON.stringify({
    headline: "Tripura Municipal Elections on November 27",
    paragraphs: ["Polling for 21 urban local bodies in Tripura will be held on November 27, 2026.", "120 nominations were filed on the first day, the editor's notes said."],
    attribution: "This is according to reports by India Today and Northeast Now.",
    state: "Tripura",
    topic: "Politics",
    sensitive: false,
  });
};

test("Bing News: the real addresses of the reports, newest first", async () => {
  const found = await newsSearch("Tripura civic polls", { fetchFn: makeFetch() });
  assert.deepEqual(found.map((r) => r.url), ["https://nenow.in/tripura-civic", "https://www.indiatoday.in/elections/tripura-civic"]);
  assert.equal(found[1].source, "India Today");
});

test("Google search through Gemini returns the real website addresses", async () => {
  const out = await searchTopic("Tripura municipal election", { apiKey: "k", fetchFn: makeFetch() });
  assert.match(out.text, /November 27, 2026/);
  assert.deepEqual(out.sources.map((s) => s.url), ["https://sec.tripura.gov.in/schedule", "https://tripuratimes.com/poll"]);
});

test("without a Gemini key it says exactly what to add", async () => {
  await assert.rejects(searchTopic("x", { apiKey: "", fetchFn: makeFetch() }), /add GEMINI_API_KEY in Vercel/);
});

test("a draft is written from the news reports and the editor's notes, even when Google's limit is used up", async () => {
  const capture = {};
  let saved = null;
  const store = { createDraft: async (d) => ((saved = d), "draft-1") };
  process.env.GEMINI_API_KEY = "k";
  const id = await researchAndDraft({ topic: "Tripura civic polls", notes: "120 nominations were filed on the first day.", store, generate: writer(capture), get, fetchFn: makeFetch({ googleStatus: 429 }) });
  assert.equal(id, "draft-1");
  assert.match(capture.content, /Notes from the InsightNE News editor/);
  assert.match(capture.content, /India Today/);
  assert.match(capture.content, /The two parties will contest together/, "a report that cannot be read keeps Bing's summary");
  assert.equal(saved.status, "pending");
  assert.ok(saved.flags.includes("research"), "never auto-published");
  assert.deepEqual(saved.sources.map((s) => s.name), ["Northeast Now", "India Today"]);
  assert.ok(saved.problems.some((p) => /Google search was not used/.test(p)), "says why Google was not used");
});

test("with Google's search too, its findings and websites are added", async () => {
  const capture = {};
  let saved = null;
  await researchAndDraft({ topic: "Tripura civic polls", store: { createDraft: async (d) => ((saved = d), "x") }, generate: writer(capture), get, fetchFn: makeFetch() });
  assert.match(capture.content, /Google search results \(gathered by Gemini\)/);
  assert.ok(saved.sources.some((s) => s.url === "https://sec.tripura.gov.in/schedule"));
});
