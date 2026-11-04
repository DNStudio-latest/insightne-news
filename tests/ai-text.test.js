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

// ---- trained model, sentence scoring, humanizer v2, corpus cleaning ----
import { scoreSentences, applyAlternative, ngramCounts } from "../public/ai-tools/engine.js";
import { TRAINED_MODEL } from "../public/ai-tools/model.js";
import { trainWithSplits, metrics } from "../scripts/ai-text-train.js";
import { clean, looksLikePromptLeak, leadSection } from "../scripts/ai-text-corpus.js";

const AI_ESSAY =
  "In today's fast-paced world, technology plays a crucial role in education. Moreover, digital tools enhance learning outcomes for students across the globe. Additionally, online platforms provide access to a wide range of resources. In conclusion, embracing technology in education is essential for preparing students for the future. Overall, the integration of technology offers numerous benefits that cannot be ignored.";
const HUMAN_NOTE =
  "Honestly I wasn't sure the bus would come. We waited forty minutes in the rain, my shoes soaked through, and then two showed up at once — typical. Raj said he'd walk next time. I said he'd said that last week too. Anyway we got to the lab late and the centrifuge was booked till four, so that was the afternoon gone.";

test("the built-in model is a valid trained model with word/phrase weights and test results", () => {
  validateModel(TRAINED_MODEL);
  assert.equal(TRAINED_MODEL.kind, "trained-ngram");
  assert.ok(Object.keys(TRAINED_MODEL.ngrams).length > 1000);
  assert.ok(TRAINED_MODEL.training.test_metrics.accuracy > 0.85);
  assert.equal(typeof TRAINED_MODEL.sentenceThreshold, "number");
});

test("the trained model separates a stock AI paragraph from casual human writing and names the phrases", () => {
  const ai = scoreText(AI_ESSAY, TRAINED_MODEL);
  const human = scoreText(HUMAN_NOTE, TRAINED_MODEL);
  assert.ok(ai.score > 70, `AI ${ai.score}`);
  assert.ok(human.score < 30, `human ${human.score}`);
  assert.ok(ai.phrases.ai.length > 0);
  assert.ok(ai.notes.some((n) => n.includes("test texts")));
});

test("word and two-word phrase counts are lower case", () => {
  assert.deepEqual([...ngramCounts("The cat. The cat!")], [["the", 2], ["the cat", 2], ["cat", 2], ["cat the", 1]]);
});

test("sentences are scored, located and flagged with their cues", () => {
  const sentences = scoreSentences(AI_ESSAY, TRAINED_MODEL);
  assert.equal(sentences.length, 5);
  for (const s of sentences) assert.equal(AI_ESSAY.slice(s.index, s.index + s.sentence.length), s.sentence);
  assert.ok(sentences.some((s) => s.aiLike && s.cues.length));
  assert.deepEqual(scoreSentences(AI_ESSAY), [], "a model without phrase weights does not score sentences");
});

test("style edit offers alternatives, flags patterns and AI-like sentences", () => {
  const r = styleEdit(`${AI_ESSAY} It is not just a tool, it is a revolution. Not only does it help, but also it inspires.`, { model: TRAINED_MODEL });
  const kinds = new Set(r.suggestions.map((s) => s.kind));
  for (const k of ["phrase", "pattern", "sentence"]) assert.ok(kinds.has(k), k);
  const crucial = r.suggestions.find((s) => s.phrase?.toLowerCase().includes("crucial"));
  assert.ok(crucial.alternatives.length > 0);
  for (const s of r.suggestions.filter((x) => x.phrase)) {
    assert.equal(r.text.slice(s.index, s.index + s.length).toLowerCase(), s.phrase.toLowerCase(), "indexes point into the returned text");
  }
});

test("more wordy phrases are fixed automatically without changing grammar", () => {
  const r = styleEdit("The majority of the samples were tested prior to analysis. We are able to make use of a large number of tools.");
  assert.equal(r.text, "Most of the samples were tested before analysis. We can use many tools.");
});

test("an alternative replaces the phrase; Delete removes an opener and fixes capitals", () => {
  const text = "Results were clear. Moreover, the method is crucial here.";
  const r = styleEdit(text);
  const moreover = r.suggestions.find((s) => s.phrase === "Moreover,");
  assert.equal(applyAlternative(r.text, moreover, ""), "Results were clear. The method is crucial here.");
  const crucial = r.suggestions.find((s) => s.phrase === "crucial");
  assert.equal(applyAlternative(r.text, crucial, "key"), "Results were clear. Moreover, the method is key here.");
});

test("corpus cleaning removes prompt echoes, encoding junk and Wikipedia sections", () => {
  assert.equal(clean("Write an abstract for a Wikipedia article with a title: \"X\". Abstract:\nX is a town."), "X is a town.");
  assert.equal(clean("ĠHelloĠworld"), "Hello world");
  assert.equal(clean("The prompt here is long enough. Then the answer.", { prompt: "The prompt here is long enough." }), "Then the answer.");
  assert.ok(looksLikePromptLeak("Write a detailed response for the question. Use approximately 200 tokens."));
  assert.ok(!looksLikePromptLeak("We measured the response of the cells."));
  const article = "Alpha is a village in the north of the district with a long history of farming and trade.\nIt has two schools, a market and a temple that draws visitors in spring each year from nearby towns.\nHistory\nAlpha was founded in 1820.";
  assert.ok(!leadSection(article).includes("History"));
});

test("training with a split column reports held-out test metrics", () => {
  const ai = ["Furthermore, it is important to note that this approach is comprehensive.", "Moreover, the framework plays a crucial role in fostering robust outcomes.", "Additionally, stakeholders must navigate the complexities of this landscape."];
  const hu = ["I didn't expect that.", "We went home early because it rained!", "My sister laughed, she's like that.", "Honestly, I can't say."];
  const rows = [];
  for (let i = 0; i < 80; i++) {
    const split = i % 10 < 7 ? "train" : i % 10 < 8 ? "dev" : "test";
    rows.push({ label: 1, split, domain: "x", generator: "g", text: `${ai[i % 3]} ${ai[(i + 1) % 3]} Item ${i}.` });
    rows.push({ label: 0, split, domain: "x", generator: "human", text: `${hu[i % 4]} ${hu[(i + 2) % 4]} Item ${i}.` });
  }
  const { model } = trainWithSplits(rows, { grid: [{ l2: 1e-4, keep: 200, epochs: 4, minDf: 2 }] });
  validateModel(model);
  assert.ok(model.training.test_metrics.accuracy > 0.9);
  assert.ok(Object.keys(model.ngrams).length <= 200);
  assert.deepEqual(metrics([0.9, 0.1], [1, 0]).accuracy, 1);
});

// ---- Gemini corpus step (Gemini itself is replaced by a stand-in; no network) ----
import { mkdtempSync, readFileSync as readText, writeFileSync as writeText } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pickHumanTexts, promptFor, tidy, generateWithApi, writePrompts, importAnswers, readAnyText } from "../scripts/ai-text-gemini.js";

const humanRows = ["arxiv", "gb-essay"].flatMap((domain) =>
  Array.from({ length: 4 }, (_, i) => ({
    label: 0, domain, split: i % 2 ? "test" : "train", group: `${domain}:${i}`,
    text: `Human ${domain} text number ${i} about river floods and farming in the hills. `.repeat(8),
  })),
);
const longAnswer = "## Title\n**Floods** shape farming in hill regions in many ways. ".concat("Farmers adapt their crops and calendars to the rains each year. ".repeat(10));

test("Gemini prompts name the genre and length, and forbid copying", () => {
  const p = promptFor(humanRows[0]);
  assert.match(p, /abstract of a scientific research paper/);
  assert.match(p, /about \d+ words/);
  assert.match(p, /do not copy/);
  assert.equal(pickHumanTexts(humanRows, 2).length, 4, "the same number from each genre");
});

test("Gemini answers lose Markdown, and short or prompt-like answers are dropped", () => {
  assert.ok(!tidy(longAnswer).includes("#") && !tidy(longAnswer).includes("**"));
});

test("API mode saves each Gemini text with its human text's group and split, and resumes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gem-"));
  const out = join(dir, "gemini.csv");
  let calls = 0;
  const generate = async () => { calls++; return calls === 2 ? "Too short." : longAnswer; };
  const first = await generateWithApi(humanRows, { out, perDomain: 2, model: "stand-in", generate, log: () => {} });
  assert.deepEqual(first, { saved: 3, skipped: 1 });
  const rows = loadRows(readText(out, "utf8"));
  assert.ok(rows.every((r) => r.label === 1 && r.generator === "gemini"));
  const again = await generateWithApi(humanRows, { out, perDomain: 2, model: "stand-in", generate: async () => longAnswer, log: () => {} });
  assert.equal(again.saved, 1, "only the text that failed before is written again");
});

test("API mode stops cleanly when the daily limit is reached", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gem-"));
  const logs = [];
  const r = await generateWithApi(humanRows, {
    out: join(dir, "g.csv"), perDomain: 2, model: "stand-in", log: (m) => logs.push(m),
    generate: async () => { throw new Error("Gemini error 429: the free daily limit of x is used up"); },
  });
  assert.equal(r.saved, 0);
  assert.ok(logs.some((l) => l.includes("tomorrow")));
});

test("manual mode: prompts out, answers in", () => {
  const dir = mkdtempSync(join(tmpdir(), "gem-"));
  const prompts = join(dir, "prompts.csv");
  assert.equal(writePrompts(humanRows, { file: prompts, perDomain: 1 }), 2);
  const ids = parseCsv(readText(prompts, "utf8")).slice(1).map((r) => r[0]);
  const answers = join(dir, "answers.csv");
  writeText(answers, `id,text\n${ids[0]},"${longAnswer}"\nnope,"x"\n`);
  const r = importAnswers(humanRows, { answers, out: join(dir, "gemini.csv"), perDomain: 1 });
  assert.equal(r.saved, 1);
  assert.deepEqual(r.problems, ["unknown id nope"]);
});

test("an answers file saved by Excel as Windows-1252 keeps its dashes and quotes", () => {
  const dir = mkdtempSync(join(tmpdir(), "gem-"));
  const cp1252 = join(dir, "excel.csv");
  writeText(cp1252, Buffer.from([0x22, 0x61, 0x97, 0x62, 0x92, 0x63, 0x22])); // "a—b’c" in Windows-1252
  assert.equal(readAnyText(cp1252), '"a—b’c"');
  const utf8 = join(dir, "utf8.csv");
  writeText(utf8, '"a—b’c"');
  assert.equal(readAnyText(utf8), '"a—b’c"');
});
