// "Make search-friendly": suggests headlines and a search description for a story, the way people search on Google.
// It only suggests. The reporter picks one, and the story text, names and numbers are never touched.
// Uses Gemini (free) when the site has GEMINI_API_KEY, otherwise Claude (ANTHROPIC_API_KEY or OPENROUTER_API_KEY).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseJsonReply, usingOpenRouter } from "./ai.js";
import { createGeminiCaller } from "./gemini.js";
import { searchDescription } from "./seo-text.js";

export const MAX_BODY_CHARS = 3000;

export const SEO_SYSTEM = `You are the search editor of InsightNE News, a news website for Tripura and the eight states of Northeast India.
A reporter has written a story. Suggest headlines and one search description so that people searching on Google find it.

THE ONE RULE ABOVE ALL: use only facts that are in the reporter's text. Never add or change a name, designation, number, date, time, place, quote or claim. Keep the same meaning and the same legal caution (allegedly, accused, police said). If the text is not enough, still use only what it says.

HEADLINES: write exactly 3 different options.
- Sentence case, the house style: only the first word, names, places and abbreviations start with a capital (for example “Tripura Congress demands security for candidates”). Never ALL CAPS and never Title Case.
- Past tense for things that already happened (said, was arrested, died), as the house style asks; present tense only for something still going on.
- 8 to 12 words. Keep it under 70 characters and aim for 60.
- Put the place (state or town) and the main person or event near the start.
- Use the words people really type into Google: “death” (not “dies” or “passes away”), “arrested” (not “held” or “nabbed”), “accident” (not “mishap”), “election results”, “schedule”, “live”, “date”.
- Calm and factual: no clickbait, no exclamation marks, no question headlines, no full stop at the end. Use plain verbs (said, died, was arrested, announced, ordered), never dramatic ones such as sparks, rocks, shocks, slams or leads to.
- For deaths, crime, accidents and violence stay respectful and plain: no graphic detail, no guessing at causes or blame.

DESCRIPTION: exactly one, 120 to 155 characters, written as one or two plain sentences. Say what happened, where, to or by whom, and one concrete fact from the text. Do not repeat the headline word for word. End with a full stop.

Reply with only one JSON object and nothing else: {"headlines": ["…", "…", "…"], "description": "…"}`;

const Answer = z.object({ headlines: z.array(z.string()).min(1), description: z.string().default("") });

// Which AI to use: Gemini is free, so it goes first.
export function seoProvider(env = process.env) {
  if (env.GEMINI_API_KEY) return "gemini";
  if (env.ANTHROPIC_API_KEY || env.OPENROUTER_API_KEY) return "claude";
  return null;
}

function defaultGenerate(provider) {
  if (provider === "gemini") {
    // No waiting and retrying here: an editor should be told at once when the free limit is reached.
    const call = createGeminiCaller({ model: process.env.GEMINI_EDITOR_MODEL || undefined, maxOutputTokens: 1200, temperature: 0.4, gapMs: 0, retries: 0, timeoutMs: 30000 });
    return (system, text) => call(system, text);
  }
  const client = usingOpenRouter
    ? new Anthropic({ baseURL: "https://openrouter.ai/api", apiKey: null, authToken: process.env.OPENROUTER_API_KEY })
    : new Anthropic();
  const model = process.env.CLAUDE_MODEL || (usingOpenRouter ? "anthropic/claude-haiku-5.5" : "claude-haiku-5-5");
  return async (system, text) => {
    const response = await client.messages.create({ model, max_tokens: 1200, system, messages: [{ role: "user", content: text }] });
    return response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  };
}

export function buildSeoInput({ headline = "", summary = "", body = "", region = "" }) {
  return [
    `Place or state: ${region || "(not set)"}`,
    `Current headline: ${String(headline).trim() || "(none yet)"}`,
    `Current intro: ${String(summary).trim() || "(none yet)"}`,
    `Story text:\n${String(body).trim().slice(0, MAX_BODY_CHARS) || "(none)"}`,
  ].join("\n\n");
}

const numbersIn = (t) => new Set((String(t).match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/,/g, "").replace(/\.$/, "")));
const STOP = new Set("about after again against also amid and are been before between both but can could for from had has have into its more most near not off once only other over said says than that the their them then there these they this those through under until upon was were what when where which while who will with would".split(" "));
// Search words the AI is allowed to use even if the reporter's text did not (a swap for a weaker word).
const SEARCH_VOCAB = new Set("death arrested accident results election schedule live date news update".split(" "));

// Words in a suggestion that are not in the reporter's text: shown as "check this" so a wrong word is easy to see.
export function notInText(suggestion, source) {
  const have = new Set(String(source).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
  return [...new Set((String(suggestion).match(/[\p{L}]{4,}/gu) || []).map((w) => w.toLowerCase()))].filter((w) => !have.has(w) && !STOP.has(w) && !SEARCH_VOCAB.has(w) && ![...have].some((h) => h.startsWith(w.slice(0, 5)) || w.startsWith(h.slice(0, 5))));
}

// Cleans the AI answer: trims quotes and full stops, drops duplicates and anything with a number that is not in the text.
export function cleanSeoAnswer(raw, source) {
  const a = parseJsonReply(raw, Answer);
  const known = numbersIn(source);
  const seen = new Set();
  const headlines = [];
  for (const h0 of a.headlines) {
    const h = String(h0).replace(/^[\s"“”'‘’]+|[\s"“”'‘’.]+$/g, "").replace(/\s+/g, " ");
    const key = h.toLowerCase();
    if (!h || [...h].length < 15 || [...h].length > 80 || seen.has(key)) continue;
    if ([...numbersIn(h)].some((n) => !known.has(n))) continue; // a number that is not in the text is never allowed
    seen.add(key);
    headlines.push({ text: h, length: [...h].length, check: notInText(h, source) });
  }
  let description = String(a.description || "").replace(/\s+/g, " ").replace(/^[\s"“”]+|[\s"“”]+$/g, "");
  if ([...numbersIn(description)].some((n) => !known.has(n)) || [...description].length > 200) description = "";
  description = searchDescription(description); // the AI sometimes goes a few characters over 155
  return { headlines, description, descriptionCheck: description ? notInText(description, source) : [] };
}

// Returns { headlines: [{ text, length, check }], description, descriptionCheck, provider }.
export async function suggestSeo(input, { generate, provider = seoProvider() } = {}) {
  if (!String(input.headline || "").trim() && !String(input.summary || "").trim() && !String(input.body || "").trim()) throw new Error("Write the headline or the story first.");
  if (!provider && !generate) throw new Error("No AI key is set on the website (GEMINI_API_KEY, ANTHROPIC_API_KEY or OPENROUTER_API_KEY).");
  const source = buildSeoInput(input);
  const ask = generate || defaultGenerate(provider);
  let raw;
  try {
    raw = await ask(SEO_SYSTEM, source);
  } catch (err) {
    const m = String(err?.message || err);
    if (/429|quota|rate.?limit|exhausted|used up/i.test(m)) throw new Error("Gemini's free limit is reached for this minute. Wait a minute, then press the button again.");
    if (/did not answer|timeout|abort/i.test(m)) throw new Error("Gemini did not answer in time. Press the button again.");
    throw err;
  }
  let out;
  try {
    out = cleanSeoAnswer(raw, source);
  } catch {
    throw new Error("The AI answered in a form I could not read. Press the button again.");
  }
  if (!out.headlines.length) throw new Error("The AI gave no usable headline. Press the button again.");
  return { ...out, provider: provider || "custom" };
}
