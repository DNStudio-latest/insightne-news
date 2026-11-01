// The Research desk: you give a topic (and your own notes, if you have any). Gemini searches Google for it, then the
// News Hunter's writer turns what was found into a draft. The draft waits in Admin → News Hunter for you: it is
// never published by itself, because facts from web searches must be checked against the sources first.
import { createGeminiCaller } from "./gemini.js";
import { createHunterAi } from "./hunter/ai.js";
import { checkDraft } from "./hunter/checks.js";
import { states, newsTopics } from "./config.js";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const SEARCH_MODEL = process.env.RESEARCH_MODEL || "gemini-flash-latest";
const MAX_SOURCES = 10;

const RESEARCH_PROMPT = (topic, today) => `You are a news researcher for InsightNE News, a news website about Northeast India.
Today is ${today}. Use Google Search to find everything reliable about this topic, most recent first:

TOPIC: ${topic}

Report only facts found in the search results. For each fact give the name of the website or organisation that
reported it and the date. Include names, designations, places, dates, numbers and amounts exactly as found, and
official statements. Copy quotes word for word and say who said them. Say which facts are confirmed by more than one
source, and point out any reports that disagree. Prefer official sources (government websites, press releases) and
established news organisations. Do not add opinions, background you did not find, or guesses. Write plain text.`;

// Asks Gemini to search Google and report what it found. Returns { text, sources: [{ title, url }], searches }.
export async function searchTopic(topic, { apiKey = process.env.GEMINI_API_KEY, fetchFn = fetch, now = Date.now() } = {}) {
  if (!apiKey) throw new Error("The Gemini key is missing on the website: add GEMINI_API_KEY in Vercel (same key as in GitHub).");
  const today = new Date(now).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const res = await fetchFn(`${API}/${SEARCH_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: RESEARCH_PROMPT(topic, today) }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("Gemini's free search limit is used up for now. Please try again later.");
    throw new Error(`Gemini search error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const candidate = data.candidates?.[0];
  const text = (candidate?.content?.parts || []).map((p) => p.text || "").join("").trim();
  if (!text) throw new Error(`Gemini found nothing (${candidate?.finishReason || "no answer"})`);
  const meta = candidate.groundingMetadata || {};
  const chunks = (meta.groundingChunks || []).map((c) => c.web).filter((w) => w?.uri);
  const seen = new Set();
  const sources = [];
  for (const web of chunks) {
    if (sources.length >= MAX_SOURCES) break;
    const url = await realUrl(web.uri, fetchFn);
    if (seen.has(url)) continue;
    seen.add(url);
    sources.push({ title: web.title || new URL(url).hostname, url });
  }
  return { text, sources, searches: meta.webSearchQueries || [] };
}

// Google gives its search links as redirects; this finds the real address of the news page.
async function realUrl(uri, fetchFn) {
  if (!/grounding-api-redirect/.test(uri)) return uri;
  try {
    const res = await fetchFn(uri, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000) });
    return res.headers.get("location") || uri;
  } catch {
    return uri;
  }
}

// The whole job: search, then write the draft and save it for the editor. Returns the new draft's id.
export async function researchAndDraft({ topic, notes = "", store, generate = createGeminiCaller({ model: process.env.HUNTER_MODEL || "gemini-flash-latest", maxOutputTokens: 4000, gapMs: 1000 }), fetchFn = fetch, now = Date.now() }) {
  const found = await searchTopic(topic, { fetchFn, now });
  const documents = [
    { source: "Google search results (gathered by Gemini)", kind: "page", title: topic, published: null, text: `${found.text}\n\nWebsites found: ${found.sources.map((s) => `${s.title} (${s.url})`).join("; ")}` },
  ];
  // Your own notes are facts from the editor: the writer may use them like any source.
  if (notes.trim()) documents.unshift({ source: "Notes from the InsightNE News editor", kind: "page", title: `Editor's notes on: ${topic}`, published: null, text: notes.trim() });
  const ai = createHunterAi({ generate, states, topics: newsTopics, log: () => {} });
  const d = await ai.draft(documents);
  const sourceTexts = documents.map((doc) => doc.text);
  const headline = checkDraft(d.headline, sourceTexts);
  const body = checkDraft([...d.paragraphs, d.attribution].join("\n\n"), sourceTexts);
  const flags = ["research", /\[CHECK/.test(headline.text + body.text) && "check", d.sensitive && "sensitive"].filter(Boolean);
  return store.createDraft({
    state: d.state,
    topic: d.topic,
    headline: headline.text,
    body: body.text,
    sources: found.sources.map((s) => ({ url: s.url, kind: "page", name: s.title, title: s.title, proof: null })),
    flags,
    problems: [...headline.problems, ...body.problems],
    score: null,
    language: "en",
    event: topic,
    event_at: new Date(now).toISOString(),
    status: "pending",
  });
}
