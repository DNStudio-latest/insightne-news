import { test } from "node:test";
import assert from "node:assert/strict";
import { searchTopic, researchAndDraft } from "../lib/research.js";

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

const fetchFn = async (url, init = {}) => {
  if (url.includes("generateContent")) {
    assert.deepEqual(JSON.parse(init.body).tools, [{ google_search: {} }], "searches Google");
    return new Response(JSON.stringify(searchReply), { status: 200 });
  }
  if (url.includes("grounding-api-redirect")) return new Response(null, { status: 302, headers: { location: "https://sec.tripura.gov.in/schedule" } });
  throw new Error(`unexpected ${url}`);
};

test("the search step returns what was found and the real website addresses", async () => {
  const out = await searchTopic("Tripura municipal election", { apiKey: "k", fetchFn });
  assert.match(out.text, /November 27, 2026/);
  assert.deepEqual(out.sources.map((s) => s.url), ["https://sec.tripura.gov.in/schedule", "https://tripuratimes.com/poll"]);
});

test("without a Gemini key it says exactly what to add", async () => {
  await assert.rejects(searchTopic("x", { apiKey: "", fetchFn }), /add GEMINI_API_KEY in Vercel/);
});

test("the draft uses the search results and the editor's notes, and waits for the editor", async () => {
  let seen = "";
  const generate = async (system, content) => {
    seen = content;
    return JSON.stringify({
      headline: "Tripura Municipal Elections on November 27",
      paragraphs: ["Polling for 21 urban local bodies in Tripura will be held on November 27, 2026.", "Counting is on December 2, the Commission said. 120 nominations were filed on the first day."],
      attribution: "This is according to the State Election Commission, Tripura.",
      state: "Tripura",
      topic: "Politics",
      sensitive: false,
    });
  };
  let saved = null;
  const store = { createDraft: async (d) => ((saved = d), "draft-1") };
  process.env.GEMINI_API_KEY = "k";
  const id = await researchAndDraft({ topic: "Tripura municipal election", notes: "120 nominations were filed on the first day.", store, generate, fetchFn });
  assert.equal(id, "draft-1");
  assert.match(seen, /Notes from the InsightNE News editor/);
  assert.match(seen, /120 nominations/);
  assert.equal(saved.status, "pending");
  assert.ok(saved.flags.includes("research"), "never auto-published");
  assert.equal(saved.sources.length, 2);
  assert.match(saved.body, /November 27, 2026/);
});
