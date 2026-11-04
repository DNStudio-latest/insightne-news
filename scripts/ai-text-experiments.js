// Evaluation experiments for the AI-text detector, on a corpus made by scripts/ai-text-corpus.js.
//
//   node scripts/ai-text-experiments.js corpus.csv [--out report.json]
//
// 1. Baselines on the test split: the built-in uncalibrated model, and a style-only trained model.
// 2. Full model (style + word/phrase weights) on the test split.
// 3. Unseen generator: train without one AI model's texts, test on that model's texts plus human texts.
// 4. Unseen domain: train without one domain, test on that domain.

import { readFileSync, writeFileSync } from "node:fs";
import { loadRows, prepare, fitFullModel, scoreDocs, metrics } from "./ai-text-train.js";
import { scoreText, DEFAULT_MODEL } from "../public/ai-tools/engine.js";

const SETTINGS = { l2: 1e-5, keep: 25000, epochs: 12 };

function run(train, test, opts = {}) {
  const model = fitFullModel(train, { ...SETTINGS, ...opts });
  return metrics(scoreDocs(test, model), test.map((d) => d.label));
}

const args = process.argv.slice(2);
const file = args[0];
const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : "ai-text-experiments.json";
const docs = prepare(loadRows(readFileSync(file, "utf8")));
const trainAll = docs.filter((d) => d.split === "train" || d.split === "dev");
const test = docs.filter((d) => d.split === "test");
const report = { corpus: { texts: docs.length, train: trainAll.length, test: test.length }, settings: SETTINGS };
const log = (k, m) => console.log(`${k.padEnd(34)} acc ${(m.accuracy * 100).toFixed(1)}%  AUC ${m.auc}  FPR ${(m.falsePositiveRate * 100).toFixed(1)}%  recall ${(m.recall * 100).toFixed(1)}%  n=${m.n}`);

const builtin = (text) => { try { return scoreText(text, DEFAULT_MODEL).score / 100; } catch { return 0.5; } }; // texts with no words
report.builtin_uncalibrated = metrics(test.map((d) => builtin(d.text)), test.map((d) => d.label));
log("Built-in uncalibrated model", report.builtin_uncalibrated);
report.style_only = run(trainAll, test, { useNgrams: false });
log("Style features only (trained)", report.style_only);
report.full = run(trainAll, test);
log("Full model (style + phrases)", report.full);

report.unseen_generator = {};
for (const gen of ["chatgpt", "claude", "davinci", "cohere", "dolly"]) {
  const train = trainAll.filter((d) => d.generator !== gen);
  const t = test.filter((d) => d.generator === gen || d.label === 0);
  report.unseen_generator[gen] = run(train, t);
  log(`Unseen generator: ${gen}`, report.unseen_generator[gen]);
}

report.unseen_domain = {};
for (const dom of ["arxiv", "gb-essay", "peerread", "wikipedia"]) {
  const train = trainAll.filter((d) => d.domain !== dom);
  const t = test.filter((d) => d.domain === dom);
  report.unseen_domain[dom] = run(train, t);
  log(`Unseen domain: ${dom}`, report.unseen_domain[dom]);
}

writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`Saved ${out}`);
