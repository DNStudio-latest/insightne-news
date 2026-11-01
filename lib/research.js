// The Research desk: you give a topic (and your own notes, if you have any). The agent finds the latest news
// reports on it (Bing News, free), reads them politely (only sites whose robots.txt allows it), also asks Gemini to
// search Google when Google's free limit allows, and the News Hunter's writer turns it all into a draft.
// The draft waits in Admin → News Hunter for you: it is never published by itself.
import { createGeminiCaller } from "./gemini.js";
import { createHunterAi } from "./hunter/ai.js";
import { checkDraft } from "./hunter/checks.js";
import { readItemPage } from "./hunter/pages.js";
import { createPoliteFetcher, USER_AGENT } from "./hunter/polite.js";
import { states, newsTopics } from "./config.js";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Google's free search limit differs by model, so the agent tries these in turn.
const SEARCH_MODELS = (process.env.RESEARCH_MODELS || "gemini-flash-lite-latest,gemini-flash-latest").split(",").map((m) => m.trim()).filter(Boolean);
const MAX_SOURCES = 10;
const READ_ARTICLES = 6;
const READ_TIMEOUT_MS = 15000;

const RESEARCH_PROMPT = (topic, today) => `You are a news researcher for InsightNE News, a news website about Northeast India.
Today is ${today}. Use Google Search to find everything reliable about this topic, most recent first:

TOPIC: ${topic}

Report only facts found in the search results. For each fact give the name of the website or organisation that
reported it and the date. Include names, designations, places, dates, numbers and amounts exactly as found, and
official statements. Copy quotes word for word and say who said them. Say which facts are confirmed by more than one
source, and point out any reports that disagree. Prefer official sources (government websites, press releases) and
established news organisations. Do not add opinions, background you did not find, or guesses. Write plain text.`;

const decode = (s = "") =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();

// The latest news reports on a topic from Bing News (its feed is free and open to robots).
// Returns [{ title, url, source, published, summary }], newest reports first.
export async function newsSearch(topic, { fetchFn = fetch } = {}) {
  const res = await fetchFn(`https://www.bing.com/news/search?q=${encodeURIComponent(topic)}&format=rss&setlang=en-IN&cc=IN`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Bing News answered ${res.status}`);
  const xml = await res.text();
  const items = [];
  for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const tag = (name) => decode((item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)) || [])[1]);
    const link = tag("link");
    let url = link;
    try {
      url = new URL(link).searchParams.get("url") || link; // Bing's click link holds the real address
    } catch {
      continue;
    }
    if (!/^https?:\/\//.test(url) || items.some((i) => i.url === url)) continue;
    const date = tag("pubDate");
    items.push({ title: tag("title"), url, source: tag("News:Source") || new URL(url).hostname, published: date ? new Date(date).toISOString() : null, summary: tag("description") });
  }
  return items.sort((a, b) => (b.published || "").localeCompare(a.published || ""));
}

// Reads the reports (at most a few, each site politely). A report that cannot be read keeps Bing's short summary.
async function readReports(reports, get) {
  const withTimeout = (p) => Promise.race([p, new Promise((r) => setTimeout(() => r({ ok: false, reason: "too slow" }), READ_TIMEOUT_MS))]);
  return Promise.all(
    reports.slice(0, READ_ARTICLES).map(async (r) => {
      const page = await withTimeout(get(r.url)).catch(() => ({ ok: false }));
      const text = page.ok && page.text ? readItemPage(page.text, page.url).text : "";
      return { ...r, text: text.length > 300 ? text : r.summary, read: text.length > 300 };
    }),
  );
}

// Asks Gemini to search Google and report what it found. Returns { text, sources: [{ title, url }], searches }.
export async function searchTopic(topic, { apiKey = process.env.GEMINI_API_KEY, fetchFn = fetch, now = Date.now(), models = SEARCH_MODELS } = {}) {
  if (!apiKey) throw new Error("The Gemini key is missing on the website: add GEMINI_API_KEY in Vercel (same key as in GitHub).");
  const today = new Date(now).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const errors = [];
  for (const model of models) {
    const res = await fetchFn(`${API}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: RESEARCH_PROMPT(topic, today) }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4000 },
      }),
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) {
      // Google's own reason, shortened (for example its free limit for this model).
      const reason = (await res.text()).match(/"message":\s*"([^"]{0,160})/)?.[1] || `error ${res.status}`;
      errors.push(`${model}: ${reason}`);
      continue;
    }
    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = (candidate?.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!text) {
      errors.push(`${model}: no answer (${candidate?.finishReason || "unknown"})`);
      continue;
    }
    const meta = candidate.groundingMetadata || {};
    const seen = new Set();
    const sources = [];
    for (const web of (meta.groundingChunks || []).map((c) => c.web).filter((w) => w?.uri)) {
      if (sources.length >= MAX_SOURCES) break;
      const url = await realUrl(web.uri, fetchFn);
      if (seen.has(url)) continue;
      seen.add(url);
      sources.push({ title: web.title || new URL(url).hostname, url });
    }
    return { text, sources, searches: meta.webSearchQueries || [] };
  }
  throw new Error(`Google search through Gemini was not possible: ${errors.join("; ")}`);
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

// The writer: Gemini Flash, or Flash-Lite when Flash's free limit is used up (the News Hunter uses the same key).
function writerWithFallback() {
  const flash = createGeminiCaller({ model: process.env.HUNTER_MODEL || "gemini-flash-latest", maxOutputTokens: 4000, gapMs: 1000 });
  const lite = createGeminiCaller({ model: "gemini-flash-lite-latest", maxOutputTokens: 4000, gapMs: 1000 });
  return async (system, content) => {
    try {
      return await flash(system, content);
    } catch (err) {
      if (!/429|limit|quota|busy|503/i.test(err.message)) throw err;
      return lite(system, content);
    }
  };
}

// The whole job: search, read, write the draft and save it for the editor. Returns the new draft's id.
export async function researchAndDraft({
  topic,
  notes = "",
  store,
  generate = writerWithFallback(),
  get = createPoliteFetcher({ gapMs: 2000, log: () => {} }),
  fetchFn = fetch,
  now = Date.now(),
}) {
  // Bing News and Google (through Gemini) are searched at the same time; either one is enough.
  const [news, google] = await Promise.allSettled([newsSearch(topic, { fetchFn }).then((found) => readReports(found, get)), searchTopic(topic, { fetchFn, now })]);
  const reports = news.status === "fulfilled" ? news.value : [];
  const found = google.status === "fulfilled" ? google.value : null;
  if (!reports.length && !found) {
    const why = [news.status === "rejected" && news.reason.message, google.status === "rejected" && google.reason.message].filter(Boolean).join(" | ");
    throw new Error(`Nothing was found for this topic. ${why}`);
  }

  const documents = reports.map((r) => ({ source: r.source, kind: "page", title: r.title, published: r.published, text: r.text }));
  if (found) documents.push({ source: "Google search results (gathered by Gemini)", kind: "page", title: topic, published: null, text: found.text });
  // Your own notes are facts from the editor: the writer may use them like any source.
  if (notes.trim()) documents.unshift({ source: "Notes from the InsightNE News editor", kind: "page", title: `Editor's notes on: ${topic}`, published: null, text: notes.trim() });

  const ai = createHunterAi({ generate, states, topics: newsTopics, log: () => {} });
  const d = await ai.draft(documents);
  const sourceTexts = documents.map((doc) => doc.text);
  const headline = checkDraft(d.headline, sourceTexts);
  const body = checkDraft([...d.paragraphs, d.attribution].join("\n\n"), sourceTexts);
  const sources = [...reports.map((r) => ({ url: r.url, name: r.source, title: r.title })), ...(found?.sources || []).map((s) => ({ url: s.url, name: s.title, title: s.title }))]
    .filter((s, i, all) => all.findIndex((x) => x.url === s.url) === i)
    .slice(0, MAX_SOURCES)
    .map((s) => ({ ...s, kind: "page", proof: null }));
  const flags = ["research", /\[CHECK/.test(headline.text + body.text) && "check", d.sensitive && "sensitive"].filter(Boolean);
  const notesForEditor = [!found && google.status === "rejected" && `Google search was not used: ${google.reason.message}`, reports.length && `${reports.filter((r) => r.read).length} of ${reports.length} news reports were read in full`].filter(Boolean);
  return store.createDraft({
    state: d.state,
    topic: d.topic,
    headline: headline.text,
    body: body.text,
    sources,
    flags,
    problems: [...headline.problems, ...body.problems, ...notesForEditor],
    score: null,
    language: "en",
    event: topic,
    event_at: new Date(now).toISOString(),
    status: "pending",
  });
}
