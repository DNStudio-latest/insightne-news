import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tokenize, splitSentences, extractFeatures, findAiPhrases, scoreText, styleEdit, validateModel, DEFAULT_MODEL,
} from "../public/ai-tools/engine.js";
import { parseCsv, loadRows, auc, trainModel } from "../scripts/ai-text-train.js";

const AI_TEXT =
  "Furthermore, it is important to note that the landscape of renewable energy is multifaceted. Moreover, these innovations play a crucial role in fostering sustainable growth. Additionally, stakeholders must delve into the intricate challenges.";
const HUMAN_TEXT =
  "I don’t really know what to make of it. My uncle tried solar on his roof in 2019 — it worked, mostly. We argued about the bill for weeks! Anyway, that’s the short version.";

test("words and sentences are split, including curly apostrophes and Bengali script", () => {
  assert.deepEqual(tokenize("It’s a test, isn't it?"), ["It’s", "a", "test", "isn't", "it"]);
  assert.equal(tokenize("আগরতলা শহরে বৃষ্টি").length, 3);
  assert.equal(splitSentences('He said "hi." Then he left! Why?').length, 3);
});

test("style features count contractions, first person and dashes", () => {
  const f = extractFeatures(HUMAN_TEXT).values;
  assert.ok(f.contractionRate > 0);
  assert.ok(f.firstPersonRate > 0);
  assert.ok(f.dashRate > 0);
  assert.equal(extractFeatures("").words, 0);
});

test("stock phrases are found regardless of case and apostrophe style", () => {
  const hits = findAiPhrases("It’s important to note this. We DELVE into the tapestry.").map((h) => h.phrase.toLowerCase());
  assert.deepEqual(hits, ["it’s important to note", "delve", "tapestry"]);
  assert.equal(findAiPhrases("The delver went to Fostering Street").length, 1, "only whole words match");
});

test("the score is 0–100, explains itself, and warns about short texts", () => {
  const r = scoreText(AI_TEXT);
  assert.ok(r.score >= 0 && r.score <= 100);
  assert.equal(r.reliable, false);
  assert.equal(r.signals.length, 5);
  assert.ok(r.notes.some((n) => n.includes("150 words")));
  assert.ok(scoreText(AI_TEXT).score > scoreText(HUMAN_TEXT).score);
  assert.throws(() => scoreText("   "), /Paste some text/);
});

test("a broken model file is refused", () => {
  assert.throws(() => validateModel({ features: ["a"], means: [], sds: [1], weights: [1], bias: 0 }), /not a valid model/);
  assert.equal(validateModel(DEFAULT_MODEL), DEFAULT_MODEL);
});

test("style edit replaces filler only, keeps case, and flags the rest", () => {
  const r = styleEdit("It is important to note that we utilized a robust method in order to test it.");
  assert.equal(r.text, "Note that we used a robust method to test it.");
  assert.equal(r.changes.length, 3);
  assert.ok(r.suggestions.some((s) => s.message.includes('"robust"')), "technical words are flagged, not changed");
  assert.ok(!r.suggestions.some((s) => s.message.includes("important to note")), "fixed phrases are not flagged again");
  assert.equal(styleEdit(AI_TEXT, { apply: false }).text, AI_TEXT);
});

test("CSV parsing handles quotes, commas and line breaks", () => {
  const rows = loadRows('label,text\nai,"One, two"\nhuman,"Line one\nline ""two"""\n');
  assert.deepEqual(rows, [{ label: 1, text: "One, two" }, { label: 0, text: 'Line one\nline "two"' }]);
  assert.equal(parseCsv("a,b\r\n1,2\r\n").length, 2);
  assert.throws(() => loadRows("label,text\nmaybe,x"), /not ai\/human/);
});

test("AUC is 1 for perfect separation and 0.5 for ties", () => {
  assert.equal(auc([0.9, 0.8, 0.1], [1, 1, 0]), 1);
  assert.equal(auc([0.5, 0.5], [1, 0]), 0.5);
});

test("training learns to separate two writing styles and reports cross-validation", () => {
  const aiParts = [
    "Furthermore, it is important to note that this approach is comprehensive.",
    "Moreover, the framework plays a crucial role in fostering robust outcomes.",
    "Additionally, stakeholders must navigate the complexities of this landscape.",
    "This multifaceted paradigm underscores the transformative potential of innovation.",
    "Consequently, it is essential to leverage these pivotal insights.",
  ];
  const humanParts = [
    "I didn't expect that.", "We went home early because it rained!", "My sister laughed — she's like that.",
    "Honestly, I can't say.", "It's late and I'm tired, so we'll stop here.", "Our dog ate the map. Long story.",
  ];
  const pick = (parts, i, n) => Array.from({ length: n }, (_, k) => parts[(i * 3 + k * 7) % parts.length]).join(" ");
  const rows = [];
  for (let i = 0; i < 30; i++) {
    rows.push({ label: 1, text: pick(aiParts, i, 4) });
    rows.push({ label: 0, text: pick(humanParts, i, 5) });
  }
  const model = trainModel(rows, { folds: 5 });
  validateModel(model);
  assert.ok(model.training.cv.auc > 0.9, `AUC ${model.training.cv.auc}`);
  assert.ok(scoreText(rows[0].text, model).score > scoreText(rows[1].text, model).score);
  assert.throws(() => trainModel(rows.slice(0, 4)), /Need at least/);
});
