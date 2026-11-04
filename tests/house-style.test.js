import { test } from "node:test";
import assert from "node:assert/strict";
import { applyHouseStyle, houseText, HOUSE_STYLE, WRITING_RULES } from "../lib/house-style.js";
import { EDITOR_SYSTEM, editLikeSeniorEditor } from "../lib/news-editor.js";
import { SUMMARY_SYSTEM, createClaudeAi } from "../lib/ai.js";
import { createGeminiAi } from "../lib/gemini.js";
import { createHunterAi } from "../lib/hunter/ai.js";
import { checkDraft } from "../lib/hunter/checks.js";

test("the senior editor's writing rules are shared, and the house rules are in them", () => {
  assert.ok(EDITOR_SYSTEM.includes(WRITING_RULES), "the editor uses the shared rules");
  for (const rule of [/Use "said"/, /Do not write "occurred"/, /", prompting…"/, /Press Council of India/, /Allegations stay allegations/]) {
    assert.match(WRITING_RULES, rule);
  }
  assert.match(HOUSE_STYLE, /never change any word inside direct quotation marks/);
  assert.match(HOUSE_STYLE, /never add a fact/);
});

test("the AI checker's automatic corrections are made, but never inside a quotation", () => {
  const r = applyHouseStyle('In order to help, the board met prior to the vote. He said, "We met prior to the vote in order to decide." She said “in order to” twice.');
  assert.equal(r.text, 'To help, the board met before the vote. He said, "We met prior to the vote in order to decide." She said “in order to” twice.');
  assert.deepEqual(r.changes.map((c) => c.to), ["To", "before"]);
  assert.equal(houseText(""), "");
  assert.equal(houseText("Police said 12 people were hurt."), "Police said 12 people were hurt.", "clean text is unchanged");
});

test("daily summaries: the house rules are in the instructions and the corrections are made (Claude)", async () => {
  assert.ok(SUMMARY_SYSTEM.endsWith(HOUSE_STYLE));
  let system = "";
  const client = {
    messages: {
      parse: async (req) => {
        system = req.system;
        return { stop_reason: "end_turn", parsed_output: { headline: "Board meets prior to vote", summary: "The board met in order to plan the vote, officials said.", region: "Tripura", topic: null, needs_extra_check: false, check_reasons: [] } };
      },
    },
  };
  const s = await createClaudeAi({ client, states: ["Tripura"] }).summarize([{ sourceName: "x", title: "t", snippet: "s", sourceRegion: "Tripura" }]);
  assert.match(system, /HOUSE STYLE/);
  assert.equal(s.headline, "Board meets before vote");
  assert.equal(s.summary, "The board met to plan the vote, officials said.");
});

test("daily summaries: the corrections are made with Gemini too", async () => {
  let system = "";
  const fetchFn = async (url, init) => {
    system = JSON.parse(init.body).systemInstruction.parts[0].text;
    const text = JSON.stringify({ headline: "Board meets prior to vote", summary: "The board met in order to plan.", region: "Tripura", topic: null, needs_extra_check: false, check_reasons: [] });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }));
  };
  const ai = createGeminiAi({ rules: {}, states: ["Tripura"], apiKey: "k", fetchFn, gapMs: 0 });
  const s = await ai.summarize([{ sourceName: "x", title: "t", snippet: "s", sourceRegion: "Tripura" }]);
  assert.match(system, /HOUSE STYLE/);
  assert.equal(s.headline, "Board meets before vote");
  assert.equal(s.summary, "The board met to plan.");
});

test("Research desk and News Hunter drafts: house rules, corrections, and quotes kept word for word", async () => {
  let system = "";
  const source = 'The minister said, "We will act prior to the monsoon." The minister said the work would start in March.';
  const ai = createHunterAi({
    states: ["Tripura"],
    topics: [],
    generate: async (s) => {
      system = s;
      return JSON.stringify({ headline: "Minister promises work prior to monsoon", paragraphs: ['The minister said, "We will act prior to the monsoon."', "Work will start in March in order to finish before the rains, he said."], attribution: "This is according to a press release.", state: "Tripura", topic: null, sensitive: false });
    },
  });
  const d = await ai.draft([{ source: "s", kind: "page", title: "t", published: null, text: source }]);
  assert.match(system, /HOUSE STYLE/);
  assert.ok(system.indexOf("HOUSE STYLE") > system.indexOf("Use ONLY facts"), "the writer's facts rules come first");
  assert.equal(d.headline, "Minister promises work before monsoon");
  assert.equal(d.paragraphs[0], 'The minister said, "We will act prior to the monsoon."', "the quote is untouched");
  assert.equal(d.paragraphs[1], "Work will start in March to finish before the rains, he said.");
  assert.deepEqual(checkDraft(d.paragraphs[0], [source]).problems, [], "the quote still matches the source");
});

test("senior editor: the corrections are made on everything it returns, but not inside quotes", async () => {
  const r = await editLikeSeniorEditor('Agartala, Nov 4: The minister met officials prior to the review. He said, "We met prior to it."', {
    generate: async () => JSON.stringify({
      headline: "Minister meets officials prior to review in Agartala",
      short_headline: "Minister meets officials prior to review",
      headline_options: ["Agartala: minister meets officials prior to review"],
      intro: "The minister meets officials in order to prepare for a review, he says.",
      body: 'AGARTALA, Nov 4: The minister met officials prior to the review.\n\nHe said, "We met prior to it."',
      notes: [],
      changes: [],
    }),
  });
  assert.equal(r.headline, "Minister meets officials before review in Agartala");
  assert.equal(r.shortHeadline, "Minister meets officials before review");
  assert.deepEqual(r.headlineOptions, ["Agartala: minister meets officials before review"]);
  assert.equal(r.intro, "The minister meets officials to prepare for a review, he says.");
  assert.equal(r.body, 'Agartala, Nov 4: The minister met officials before the review.\n\nHe said, "We met prior to it."');
});
