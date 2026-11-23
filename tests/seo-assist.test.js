import test from "node:test";
import assert from "node:assert/strict";
import { suggestSeo, cleanSeoAnswer, notInText, buildSeoInput, seoProvider } from "../lib/seo-assist.js";

const story = {
  headline: "Assamese Content Creator Jugamaya Dutta Dies; Family Appeals Against Speculation",
  summary: "Family member says Dutta wanted to visit home again weeks after her recent trip to Assam; police are examining her mobile phone.",
  body: "Guwahati: Content creator Jugamaya Dutta died on Monday. Her family asked people not to speculate. Police are examining her mobile phone.",
  region: "Assam",
};
const reply = (o) => JSON.stringify(o);

test("returns cleaned headlines and a description from the AI answer", async () => {
  const generate = async () => reply({ headlines: ["“Jugamaya Dutta Death: Family Appeals Against Speculation.”", "Assam Content Creator Jugamaya Dutta Death: Police Examine Phone", "Jugamaya Dutta Death: Family Appeals Against Speculation"], description: "Content creator Jugamaya Dutta died in Guwahati; her family appealed against speculation as police examine her phone." });
  const out = await suggestSeo(story, { generate, provider: "gemini" });
  assert.equal(out.headlines[0].text, "Jugamaya Dutta Death: Family Appeals Against Speculation"); // quotes and full stop removed
  assert.equal(out.headlines.length, 2); // the duplicate is dropped
  assert.ok(out.description.length > 50);
});

test("a description a few characters over 155 is cut at a sentence", () => {
  const long = "Assamese content creator Jugamaya Dutta died, and her family appealed against speculation. Police are examining her mobile phone as the investigation continues.";
  const out = cleanSeoAnswer(reply({ headlines: ["Jugamaya Dutta Death: Family Appeals Against Speculation"], description: long }), buildSeoInput(story));
  assert.ok([...out.description].length <= 155);
  assert.ok(out.description.endsWith("speculation."));
});

test("a suggestion with a number that is not in the text is dropped", () => {
  const out = cleanSeoAnswer(reply({ headlines: ["Jugamaya Dutta Death: Police Question 5 People", "Jugamaya Dutta Death: Family Appeals Against Speculation"], description: "Police questioned 7 people." }), buildSeoInput(story));
  assert.equal(out.headlines.length, 1);
  assert.equal(out.description, "");
});

test("words that are not in the reporter's text are listed so they can be checked", () => {
  const src = buildSeoInput(story);
  assert.deepEqual(notInText("Jugamaya Dutta Death: Family Appeals Against Speculation", src), []);
  assert.ok(notInText("Jugamaya Dutta Death: Murder Probe Ordered in Silchar", src).includes("silchar"));
});

test("a reply that is not JSON gives a plain error", async () => {
  await assert.rejects(() => suggestSeo(story, { generate: async () => "Sorry, I cannot do that.", provider: "gemini" }), /could not read/);
});

test("the free-limit error is explained in plain words", async () => {
  const generate = async () => { throw new Error("Gemini error 429: Quota exceeded for metric generate_content_free_tier_requests"); };
  await assert.rejects(() => suggestSeo(story, { generate, provider: "gemini" }), /free limit is reached for this minute/);
  const slow = async () => { throw new Error("Gemini did not answer in 30 seconds"); };
  await assert.rejects(() => suggestSeo(story, { generate: slow, provider: "gemini" }), /did not answer in time/);
});

test("nothing written asks for text; no AI key is explained", async () => {
  await assert.rejects(() => suggestSeo({ headline: "", summary: "", body: "" }, { generate: async () => "" }), /Write the headline/);
  await assert.rejects(() => suggestSeo(story, { provider: null }), /No AI key/);
});

test("Gemini is used first because it is free", () => {
  assert.equal(seoProvider({ GEMINI_API_KEY: "g", ANTHROPIC_API_KEY: "a" }), "gemini");
  assert.equal(seoProvider({ ANTHROPIC_API_KEY: "a" }), "claude");
  assert.equal(seoProvider({}), null);
});
