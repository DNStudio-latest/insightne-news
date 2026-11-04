// How well does the detector catch texts from a new AI model (for example Gemini)?
//
//   node scripts/ai-text-new-model-eval.js corpus.csv gemini.csv [--out report.json]
//
// 1. Zero-shot: the built-in model (public/ai-tools/model.js), which has never seen the new model, scores
//    every new-model text; human texts are the corpus test split, which it has not seen either.
// 2. With training: 5-fold. The model is trained on the corpus (train + dev) plus 4/5 of the new texts and
//    scores the held-out fifth, so every new text is scored by a model that did not see it.
import { readFileSync, writeFileSync } from "node:fs";
import { loadRows, prepare, fitFullModel, scoreDocs, metrics } from "./ai-text-train.js";
import { TRAINED_MODEL } from "../public/ai-tools/model.js";
const args = process.argv.slice(2);
const [corpusFile, geminiFile] = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
const outFile = args.includes("--out") ? args[args.indexOf("--out") + 1] : "new-model-eval.json";
if (!corpusFile || !geminiFile) { console.log("Usage: node scripts/ai-text-new-model-eval.js corpus.csv new-model.csv [--out report.json]"); process.exit(1); }
const corpus = prepare(loadRows(readFileSync(corpusFile, "utf8")));
const gemini = prepare(loadRows(readFileSync(geminiFile, "utf8")));
const humanTest = corpus.filter((d) => d.split === "test" && d.label === 0);
const caught = (scores) => scores.filter((s) => s >= 0.5).length;
const report = { gemini_texts: gemini.length, human_test_texts: humanTest.length };

// 1. Zero-shot: the built-in model has never seen Gemini.
const zs = scoreDocs(gemini, TRAINED_MODEL);
const zsHuman = scoreDocs(humanTest, TRAINED_MODEL);
report.zero_shot = { caught: caught(zs), ...metrics([...zs, ...zsHuman], [...zs.map(() => 1), ...zsHuman.map(() => 0)]) };
report.zero_shot.by_genre = {};
for (const g of [...new Set(gemini.map((d) => d.domain))].sort()) {
  const s = zs.filter((_, i) => gemini[i].domain === g);
  report.zero_shot.by_genre[g] = `${caught(s)}/${s.length}`;
}
console.log("ZERO-SHOT", JSON.stringify(report.zero_shot));

// 2. 5-fold: train on the corpus (train+dev) plus 4/5 of the Gemini texts; score the held-out fifth.
const train0 = corpus.filter((d) => d.split !== "test");
const oof = new Array(gemini.length);
const settings = { l2: 1e-5, keep: 25000, epochs: 12 };
for (let k = 0; k < 5; k++) {
  const inFold = (i) => i % 5 === k;
  const model = fitFullModel([...train0, ...gemini.filter((_, i) => !inFold(i))], settings);
  const s = scoreDocs(gemini.filter((_, i) => inFold(i)), model);
  gemini.forEach((_, i) => { if (inFold(i)) oof[i] = s.shift(); });
  const h = scoreDocs(humanTest, model);
  report[`fold${k}_human_fpr`] = Math.round((h.filter((x) => x >= 0.5).length / h.length) * 1e4) / 1e4;
  console.log(`fold ${k + 1}/5 done; human false-positive rate ${report[`fold${k}_human_fpr`]}`);
}
report.with_gemini_training = { caught: caught(oof), recall: Math.round((caught(oof) / oof.length) * 1e4) / 1e4 };
report.with_gemini_training.by_genre = {};
for (const g of [...new Set(gemini.map((d) => d.domain))].sort()) {
  const s = oof.filter((_, i) => gemini[i].domain === g);
  report.with_gemini_training.by_genre[g] = `${caught(s)}/${s.length}`;
}
console.log("WITH GEMINI TRAINING", JSON.stringify(report.with_gemini_training));
writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log(`Saved ${outFile}`);
