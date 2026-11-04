// Automatic checks for the Kokborok (trp) language. A pretend Gemini answers, so nothing is sent to Google.
import { test } from "node:test";
import assert from "node:assert/strict";

const { LANGUAGES, LANGUAGE_CODES, TRANSLATED, validLang, missingLanguages, storyText } = await import("../lib/languages.js");
const { createGeminiAi } = await import("../lib/gemini.js");

test("Kokborok is offered as a reader language, and unknown codes still fall back to English", () => {
  const kok = LANGUAGES.find((l) => l.code === "trp");
  assert.ok(kok, "Kokborok is in the language list");
  assert.equal(kok.english, "Kokborok");
  assert.ok(LANGUAGE_CODES.includes("trp"));
  assert.ok(TRANSLATED.includes("trp"));
  assert.equal(validLang("trp"), "trp");
  assert.equal(validLang("xx"), "en");
});

test("a story with no Kokborok translation yet is listed as missing it; one with a translation is not", () => {
  const plain = { headline: "h", summary: "s", translations: {} };
  assert.ok(missingLanguages(plain).includes("trp"));
  const done = { headline: "h", summary: "s", translations: { trp: { headline: "H", summary: "Ss" } } };
  assert.ok(!missingLanguages(done).includes("trp"));
  assert.equal(storyText(done, "headline", "trp"), "H");
});

test("Kokborok translation asks for Latin script and keeps the answer in the right place", async () => {
  const sent = [];
  const fetchFn = async (url, opts) => {
    sent.push(JSON.parse(opts.body));
    const text = JSON.stringify({ trp: { headline: "Tripura-ah bizu", summary: "Ettuk summary." } });
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }), text: async () => text };
  };
  const ai = createGeminiAi({ rules: {}, apiKey: "k", gapMs: 0, log: () => {}, fetchFn });
  const out = await ai.translate({ headline: "News", summary: "Short news." }, ["trp"]);
  assert.deepEqual(out, { trp: { headline: "Tripura-ah bizu", summary: "Ettuk summary." } });
  const prompt = sent[0].systemInstruction.parts[0].text;
  assert.match(prompt, /"trp" = Kokborok/);
  assert.match(prompt, /Latin script/);
});
