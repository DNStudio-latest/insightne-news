// Trains the AI-text detector on your own labelled texts and reports how well it works.
//
//   npm run ai-text-train -- data.csv [--out model.json] [--folds 5] [--l2 0.01]
//
// data.csv needs a header row with the columns "label" and "text".
// label: ai / 1 / machine / llm  (machine-written)   or   human / 0  (human-written)
// The model file can be loaded on the /ai-tools/ page ("Use a trained model").

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { extractFeatures, FEATURES } from "../public/ai-tools/engine.js";

const AI_LABELS = new Set(["ai", "1", "machine", "llm", "generated"]);
const HUMAN_LABELS = new Set(["human", "0", "person"]);

// RFC 4180 CSV: quoted fields may hold commas, newlines and doubled quotes ("").
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function loadRows(csvText) {
  const [header, ...body] = parseCsv(csvText.replace(/^﻿/, ""));
  const cols = (header || []).map((h) => h.trim().toLowerCase());
  const li = cols.indexOf("label");
  const ti = cols.indexOf("text");
  if (li < 0 || ti < 0) throw new Error('The CSV needs a header row with "label" and "text" columns.');
  return body.map((r, n) => {
    const raw = (r[li] || "").trim().toLowerCase();
    const label = AI_LABELS.has(raw) ? 1 : HUMAN_LABELS.has(raw) ? 0 : null;
    if (label === null) throw new Error(`Row ${n + 2}: label "${r[li]}" is not ai/human (or 1/0).`);
    return { label, text: r[ti] || "" };
  });
}

function columnStats(X) {
  const d = X[0].length;
  const means = Array.from({ length: d }, (_, j) => X.reduce((a, x) => a + x[j], 0) / X.length);
  const sds = means.map((m, j) => Math.sqrt(X.reduce((a, x) => a + (x[j] - m) ** 2, 0) / X.length) || 1);
  return { means, sds };
}

const standardize = (X, means, sds) => X.map((x) => x.map((v, j) => (v - means[j]) / sds[j]));
const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// L2-regularised logistic regression, full-batch gradient descent on standardised features.
export function fitLogistic(X, y, { l2 = 0.01, lr = 0.5, iterations = 1500 } = {}) {
  const d = X[0].length;
  const n = X.length;
  const w = new Array(d).fill(0);
  let b = 0;
  for (let it = 0; it < iterations; it++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * X[i][j];
      const e = sigmoid(z) - y[i];
      gb += e;
      for (let j = 0; j < d; j++) gw[j] += e * X[i][j];
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / n + l2 * w[j]);
    b -= (lr * gb) / n;
  }
  return { weights: w, bias: b };
}

const predict = (x, { weights, bias }) => sigmoid(bias + x.reduce((a, v, j) => a + v * weights[j], 0));

// Area under the ROC curve (Mann–Whitney). 0.5 = chance, 1 = perfect separation.
export function auc(scores, labels) {
  const pos = scores.filter((_, i) => labels[i] === 1);
  const neg = scores.filter((_, i) => labels[i] === 0);
  if (!pos.length || !neg.length) return NaN;
  let wins = 0;
  for (const p of pos) for (const q of neg) wins += p > q ? 1 : p === q ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

function seededShuffle(n, seed = 42) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const idx = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx;
}

const featureMatrix = (rows) => rows.map((r) => FEATURES.map((f) => extractFeatures(r.text).values[f]));

// k-fold cross-validation. Standardisation is fitted inside each fold to avoid leakage.
export function crossValidate(rows, { folds = 5, ...fitOptions } = {}) {
  const X = featureMatrix(rows);
  const y = rows.map((r) => r.label);
  const order = seededShuffle(rows.length);
  const scores = new Array(rows.length);
  for (let k = 0; k < folds; k++) {
    const test = order.filter((_, i) => i % folds === k);
    const testSet = new Set(test);
    const train = order.filter((i) => !testSet.has(i));
    const { means, sds } = columnStats(train.map((i) => X[i]));
    const fit = fitLogistic(standardize(train.map((i) => X[i]), means, sds), train.map((i) => y[i]), fitOptions);
    for (const i of test) scores[i] = predict(standardize([X[i]], means, sds)[0], fit);
  }
  const correct = scores.filter((s, i) => (s >= 0.5 ? 1 : 0) === y[i]).length;
  return { accuracy: correct / rows.length, auc: auc(scores, y), n: rows.length, folds };
}

export function trainModel(rows, { folds = 5, l2 = 0.01, name = "Trained model" } = {}) {
  const aiRows = rows.filter((r) => r.label === 1).length;
  const humanRows = rows.length - aiRows;
  if (aiRows < folds || humanRows < folds) {
    throw new Error(`Need at least ${folds} AI and ${folds} human texts (have ${aiRows} AI, ${humanRows} human).`);
  }
  const cv = crossValidate(rows, { folds, l2 });
  const X = featureMatrix(rows);
  const { means, sds } = columnStats(X);
  const fit = fitLogistic(standardize(X, means, sds), rows.map((r) => r.label), { l2 });
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  return {
    kind: "trained",
    name,
    createdAt: new Date().toISOString(),
    features: FEATURES,
    means: means.map(r4),
    sds: sds.map(r4),
    weights: fit.weights.map(r4),
    bias: r4(fit.bias),
    thresholds: { low: 0.3, high: 0.7 },
    training: { rows: rows.length, aiRows, humanRows, l2, cv: { accuracy: r4(cv.accuracy), auc: r4(cv.auc), folds } },
  };
}

function main(argv) {
  const args = argv.slice(2);
  const opt = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const file = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  if (!file) {
    console.log("Usage: npm run ai-text-train -- data.csv [--out model.json] [--folds 5] [--l2 0.01]");
    process.exit(1);
  }
  const rows = loadRows(readFileSync(file, "utf8"));
  const model = trainModel(rows, {
    folds: Number(opt("--folds", 5)),
    l2: Number(opt("--l2", 0.01)),
    name: opt("--name", `Trained on ${file}`),
  });
  const out = opt("--out", "ai-text-model.json");
  writeFileSync(out, JSON.stringify(model, null, 2));

  const t = model.training;
  console.log(`Texts: ${t.rows} (${t.aiRows} AI, ${t.humanRows} human)`);
  console.log(`${t.cv.folds}-fold cross-validation: accuracy ${(t.cv.accuracy * 100).toFixed(1)}%, AUC ${t.cv.auc.toFixed(3)}`);
  console.log("Feature weights (standardised; + = more AI-like):");
  model.features
    .map((f, i) => [f, model.weights[i]])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .forEach(([f, w]) => console.log(`  ${w >= 0 ? "+" : ""}${w.toFixed(3)}  ${f}`));
  console.log(`Model saved to ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
