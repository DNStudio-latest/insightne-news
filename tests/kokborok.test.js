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

test("saving keeps or replaces the Kokborok version; changed English clears the machine versions", async () => {
  const { translationsAfterEdit } = await import("../lib/languages.js");
  const existing = { translations: { hi: { headline: "h", summary: "s" }, trp: { headline: "old", summary: "old" } } };
  assert.deepEqual(translationsAfterEdit(existing, false, undefined), existing.translations, "no Kokborok boxes: unchanged");
  assert.deepEqual(translationsAfterEdit(existing, false, { headline: "new", summary: "new" }).trp, { headline: "new", summary: "new" });
  assert.deepEqual(translationsAfterEdit(existing, false, null), { hi: { headline: "h", summary: "s" } }, "empty boxes remove the Kokborok version");
  assert.deepEqual(translationsAfterEdit(existing, true, undefined), {}, "changed English clears the machine versions");
  assert.deepEqual(translationsAfterEdit(existing, true, { headline: "k", summary: "k" }), { trp: { headline: "k", summary: "k" } }, "a Kokborok version typed in the same save is kept");
  assert.deepEqual(translationsAfterEdit(null, false, { headline: "k", summary: "k" }), { trp: { headline: "k", summary: "k" } });
});

test("Kokborok in Bengali script is a second reader language, shown with its own page language tag", async () => {
  const { htmlLang } = await import("../lib/languages.js");
  const bn = LANGUAGES.find((l) => l.code === "trpb");
  assert.ok(bn, "Bengali-script Kokborok is in the language list");
  assert.equal(bn.english, "Kokborok (Bengali script)");
  assert.equal(validLang("trpb"), "trpb");
  assert.ok(TRANSLATED.includes("trpb"));
  assert.equal(htmlLang("trpb"), "trp-Beng");
  assert.equal(htmlLang("trp"), "trp");
  assert.equal(htmlLang("hi"), "hi");
  assert.equal(htmlLang("xx"), "en");
});

test("Bengali-script Kokborok shows its own text, then the Roman Kokborok, then English", () => {
  const both = { headline: "E", translations: { trp: { headline: "R", summary: "r" }, trpb: { headline: "ককবরক", summary: "ক" } } };
  const romanOnly = { headline: "E", translations: { trp: { headline: "R", summary: "r" } } };
  assert.equal(storyText(both, "headline", "trpb"), "ককবরক");
  assert.equal(storyText(romanOnly, "headline", "trpb"), "R");
  assert.equal(storyText({ headline: "E" }, "headline", "trpb"), "E");
  assert.equal(storyText(both, "headline", "trp"), "R", "the Roman version never shows Bengali letters");
  assert.deepEqual(missingLanguages(romanOnly).filter((c) => c.startsWith("trp")), ["trpb"]);
});

test("editing the two Kokborok scripts keeps and removes each one separately", async () => {
  const { translationsAfterEdit } = await import("../lib/languages.js");
  const existing = { translations: { hi: { headline: "h", summary: "s" }, trp: { headline: "R", summary: "r" }, trpb: { headline: "B", summary: "b" } } };
  assert.deepEqual(translationsAfterEdit(existing, false, undefined, undefined), existing.translations);
  assert.equal(translationsAfterEdit(existing, false, undefined, { headline: "new", summary: "new" }).trpb.headline, "new");
  assert.equal(translationsAfterEdit(existing, false, undefined, { headline: "new", summary: "new" }).trp.headline, "R");
  assert.equal("trpb" in translationsAfterEdit(existing, false, undefined, null), false);
  assert.equal(translationsAfterEdit(existing, false, undefined, null).trp.headline, "R");
  assert.deepEqual(translationsAfterEdit(existing, true, { headline: "k", summary: "k" }, { headline: "ক", summary: "ক" }), { trp: { headline: "k", summary: "k" }, trpb: { headline: "ক", summary: "ক" } });
});

test("Bengali-script Kokborok is asked for as the same text as the Roman version", async () => {
  const sent = [];
  const fetchFn = async (url, opts) => {
    sent.push(JSON.parse(opts.body));
    const out = {};
    for (const c of ["hi", "trp", "trpb"]) out[c] = { headline: "H", summary: "S" };
    const text = JSON.stringify(out);
    return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }), text: async () => text };
  };
  const ai = createGeminiAi({ rules: {}, apiKey: "k", gapMs: 0, log: () => {}, fetchFn });
  // Both scripts at once: the Bengali one must copy the Roman one.
  await ai.translate({ headline: "News", summary: "Short news." }, ["trp", "trpb"]);
  assert.match(sent[0].systemInstruction.parts[0].text, /"trpb" must be exactly the same Kokborok text as "trp"/);
  // Only the Bengali script missing: the existing Roman text is sent along to be converted.
  await ai.translate({ headline: "News", summary: "Short news.", trp: { headline: "Rh", summary: "Rs" } }, ["trpb"]);
  assert.match(sent[1].systemInstruction.parts[0].text, /"kokborok_latin"/);
  assert.deepEqual(JSON.parse(sent[1].contents[0].parts[0].text).kokborok_latin, { headline: "Rh", summary: "Rs" });
  // Nothing to copy: no extra rule.
  await ai.translate({ headline: "News", summary: "Short news." }, ["hi"]);
  assert.doesNotMatch(sent[2].systemInstruction.parts[0].text, /trpb/);
});
