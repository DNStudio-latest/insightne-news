// Trains the AI-text detector on labelled texts and reports how well it works.
//
//   npm run ai-text-train -- data.csv [more.csv …] [--out model.json] [--name "My model"]
//
// data.csv needs a header row with the columns "label" and "text".
//   label: ai / 1 / machine / llm  (machine-written)   or   human / 0  (human-written)
// Optional columns:
//   split      train / dev / test. When present, the full model (style features + word and phrase weights)
//              is trained on "train", tuned on "dev" and reported on "test". scripts/ai-text-corpus.js
//              writes this column.
//   domain, generator   used only to break the test results down.
// Without a split column (small corpora) the style-only model is trained with k-fold cross-validation
// (--folds 5, --l2 0.01).
//
// The model file can be loaded on the /ai-tools/ page ("Use a trained model").

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { extractFeatures, ngramCounts, ngramVector, scoreSentences, FEATURES } from "../public/ai-tools/engine.js";

const AI_LABELS = new Set(["ai", "1", "machine", "llm", "generated"]);
const HUMAN_LABELS = new Set(["human", "0", "person"]);

// ---------- CSV ----------

// RFC 4180 CSV: quoted fields may hold commas, newlines and doubled quotes ("").
// Fields are copied as whole slices (not character by character), so large corpora fit in memory.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    let field;
    if (text[i] === '"') {
      const parts = [];
      let from = i + 1;
      for (;;) {
        const q = text.indexOf('"', from);
        if (q < 0) { parts.push(text.slice(from)); i = n; break; }
        parts.push(text.slice(from, q));
        if (text[q + 1] === '"') { parts.push('"'); from = q + 2; continue; }
        i = q + 1;
        break;
      }
      field = parts.join("");
      // Anything between the closing quote and the next separator is kept, as lenient parsers do.
      let j = i;
      while (j < n && text[j] !== "," && text[j] !== "\n" && text[j] !== "\r") j++;
      if (j > i) field += text.slice(i, j);
      i = j;
    } else {
      let j = i;
      while (j < n && text[j] !== "," && text[j] !== "\n" && text[j] !== "\r") j++;
      field = text.slice(i, j);
      i = j;
    }
    row.push(field);
    if (i >= n) { rows.push(row); break; }
    const sep = text[i];
    if (sep === ",") {
      i++;
      if (i >= n) { row.push(""); rows.push(row); }
      continue;
    }
    // Line end (\n, \r or \r\n).
    i += sep === "\r" && text[i + 1] === "\n" ? 2 : 1;
    rows.push(row);
    row = [];
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

export function loadRows(csvText) {
  const [header, ...body] = parseCsv(csvText.replace(/^﻿/, ""));
  const cols = (header || []).map((h) => h.trim().toLowerCase());
  const col = (name) => cols.indexOf(name);
  const li = col("label");
  const ti = col("text");
  if (li < 0 || ti < 0) throw new Error('The CSV needs a header row with "label" and "text" columns.');
  const extras = ["split", "domain", "generator"].filter((c) => col(c) >= 0);
  return body.map((r, n) => {
    const raw = (r[li] || "").trim().toLowerCase();
    const label = AI_LABELS.has(raw) ? 1 : HUMAN_LABELS.has(raw) ? 0 : null;
    if (label === null) throw new Error(`Row ${n + 2}: label "${r[li]}" is not ai/human (or 1/0).`);
    const row = { label, text: r[ti] || "" };
    for (const c of extras) row[c] = (r[col(c)] || "").trim().toLowerCase();
    return row;
  });
}

// ---------- shared maths ----------

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const r4 = (v) => Math.round(v * 1e4) / 1e4;

function columnStats(X) {
  const d = X[0].length;
  const means = Array.from({ length: d }, (_, j) => X.reduce((a, x) => a + x[j], 0) / X.length);
  const sds = means.map((m, j) => Math.sqrt(X.reduce((a, x) => a + (x[j] - m) ** 2, 0) / X.length) || 1);
  return { means, sds };
}

const standardize = (X, means, sds) => X.map((x) => x.map((v, j) => Math.max(-4, Math.min(4, (v - means[j]) / sds[j]))));

// Area under the ROC curve (rank method, ties averaged). 0.5 = chance, 1 = perfect separation.
export function auc(scores, labels) {
  const idx = scores.map((s, i) => [s, labels[i]]).sort((a, b) => a[0] - b[0]);
  let pos = 0;
  let neg = 0;
  let rankSum = 0;
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j < idx.length && idx[j][0] === idx[i][0]) j++;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      if (idx[k][1] === 1) { pos++; rankSum += avgRank; } else neg++;
    }
    i = j;
  }
  if (!pos || !neg) return NaN;
  return (rankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}

// Accuracy, AUC, and precision/recall/F1 for the AI class at a 0.5 threshold.
export function metrics(scores, labels) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  scores.forEach((s, i) => {
    const p = s >= 0.5 ? 1 : 0;
    if (p === 1 && labels[i] === 1) tp++;
    else if (p === 1) fp++;
    else if (labels[i] === 0) tn++;
    else fn++;
  });
  const precision = tp / (tp + fp || 1);
  const recall = tp / (tp + fn || 1);
  return {
    n: scores.length,
    accuracy: r4((tp + tn) / (scores.length || 1)),
    auc: r4(auc(scores, labels)),
    precision: r4(precision),
    recall: r4(recall),
    f1: r4((2 * precision * recall) / (precision + recall || 1)),
    falsePositiveRate: r4(fp / (fp + tn || 1)),
  };
}

// ---------- small corpora: style features only, k-fold cross-validation ----------

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

const styleMatrix = (rows) => rows.map((r) => { const v = extractFeatures(r.text).values; return FEATURES.map((f) => v[f]); });

export function crossValidate(rows, { folds = 5, ...fitOptions } = {}) {
  const X = styleMatrix(rows);
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
  const m = metrics(scores, y);
  return { accuracy: m.accuracy, auc: m.auc, n: rows.length, folds };
}

export function trainModel(rows, { folds = 5, l2 = 0.01, name = "Trained model" } = {}) {
  const aiRows = rows.filter((r) => r.label === 1).length;
  const humanRows = rows.length - aiRows;
  if (aiRows < folds || humanRows < folds) {
    throw new Error(`Need at least ${folds} AI and ${folds} human texts (have ${aiRows} AI, ${humanRows} human).`);
  }
  const cv = crossValidate(rows, { folds, l2 });
  const X = styleMatrix(rows);
  const { means, sds } = columnStats(X);
  const fit = fitLogistic(standardize(X, means, sds), rows.map((r) => r.label), { l2 });
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
    training: { rows: rows.length, aiRows, humanRows, l2, cv: { accuracy: cv.accuracy, auc: cv.auc, folds } },
  };
}

// ---------- large corpora: style features + word/phrase weights ----------

// Pre-computes what every text needs once: style features and n-gram counts.
export function prepare(rows) {
  return rows.map((r) => {
    const v = extractFeatures(r.text).values;
    return { ...r, style: FEATURES.map((f) => v[f]), counts: ngramCounts(r.text) };
  });
}

function buildVocab(docs, { minDf = 5, maxVocab = 60000 } = {}) {
  const df = new Map();
  for (const d of docs) for (const g of d.counts.keys()) df.set(g, (df.get(g) || 0) + 1);
  return [...df].filter(([, c]) => c >= minDf).sort((a, b) => b[1] - a[1]).slice(0, maxVocab).map(([g]) => g);
}

function vectorize(docs, vocab, means, sds) {
  const index = new Map(vocab.map((g, i) => [g, i]));
  return docs.map((d) => ({
    dense: d.style.map((v, j) => Math.max(-4, Math.min(4, (v - means[j]) / sds[j]))),
    sparse: ngramVector(d.counts, (g) => index.has(g)).map(([g, x]) => [index.get(g), x]),
    y: d.label,
  }));
}

// Logistic regression with AdaGrad on dense style features + sparse n-gram features.
function fitSparse(data, dims, { l2 = 1e-4, epochs = 8, lr = 0.2, seed = 7 } = {}) {
  const wd = new Float64Array(dims.dense);
  const ws = new Float64Array(dims.sparse);
  const gd = new Float64Array(dims.dense).fill(1e-8);
  const gs = new Float64Array(dims.sparse).fill(1e-8);
  let b = 0;
  let gb = 1e-8;
  for (let e = 0; e < epochs; e++) {
    for (const i of seededShuffle(data.length, seed + e)) {
      const { dense, sparse, y } = data[i];
      let z = b;
      for (let j = 0; j < dense.length; j++) z += wd[j] * dense[j];
      for (const [k, x] of sparse) z += ws[k] * x;
      const err = sigmoid(z) - y;
      gb += err * err;
      b -= (lr * err) / Math.sqrt(gb);
      for (let j = 0; j < dense.length; j++) {
        const g = err * dense[j] + l2 * wd[j];
        gd[j] += g * g;
        wd[j] -= (lr * g) / Math.sqrt(gd[j]);
      }
      for (const [k, x] of sparse) {
        const g = err * x + l2 * ws[k];
        gs[k] += g * g;
        ws[k] -= (lr * g) / Math.sqrt(gs[k]);
      }
    }
  }
  return { wd, ws, b };
}

function scoreAll(data, fit) {
  return data.map(({ dense, sparse }) => {
    let z = fit.b;
    for (let j = 0; j < dense.length; j++) z += fit.wd[j] * dense[j];
    for (const [k, x] of sparse) z += fit.ws[k] * x;
    return sigmoid(z);
  });
}

// Trains on `train`, keeps the `keep` strongest phrases, retrains on those, and returns a model.
export function fitFullModel(train, { l2 = 1e-4, keep = 8000, epochs = 8, minDf = 5, useNgrams = true, name = "Trained model" } = {}) {
  const { means, sds } = columnStats(train.map((d) => d.style));
  let vocab = useNgrams ? buildVocab(train, { minDf }) : [];
  const dims = (v) => ({ dense: FEATURES.length, sparse: v.length });
  let fit = fitSparse(vectorize(train, vocab, means, sds), dims(vocab), { l2, epochs });
  if (useNgrams && vocab.length > keep) {
    vocab = vocab
      .map((g, i) => [g, Math.abs(fit.ws[i])])
      .sort((a, b) => b[1] - a[1])
      .slice(0, keep)
      .map(([g]) => g);
    fit = fitSparse(vectorize(train, vocab, means, sds), dims(vocab), { l2, epochs });
  }
  const ngrams = {};
  vocab.forEach((g, i) => { if (Math.abs(fit.ws[i]) >= 1e-4) ngrams[g] = r4(fit.ws[i]); });
  return {
    kind: useNgrams ? "trained-ngram" : "trained",
    name,
    createdAt: new Date().toISOString(),
    features: FEATURES,
    means: means.map(r4),
    sds: sds.map(r4),
    weights: [...fit.wd].map(r4),
    bias: r4(fit.b),
    thresholds: { low: 0.3, high: 0.7 },
    ...(useNgrams ? { ngrams } : {}),
  };
}

// Scores prepared docs with a finished model (same arithmetic as engine.js scoreText).
export function scoreDocs(docs, model) {
  const vocab = Object.keys(model.ngrams || {});
  const data = vectorize(docs, vocab, model.means, model.sds);
  const fit = { wd: model.weights, ws: Object.values(model.ngrams || {}), b: model.bias };
  return scoreAll(data, fit);
}

export function breakdown(docs, scores, key) {
  const out = {};
  for (const v of [...new Set(docs.map((d) => d[key]))].sort()) {
    const idx = docs.map((d, i) => (d[key] === v ? i : -1)).filter((i) => i >= 0);
    const labels = idx.map((i) => docs[i].label);
    const m = metrics(idx.map((i) => scores[i]), labels);
    // For one generator the test set holds only AI texts, so recall (share caught) is the useful figure.
    out[v] = labels.every((l) => l === labels[0]) ? { n: m.n, accuracy: m.accuracy } : m;
  }
  return out;
}

// Lowest sentence score at which at least `precision` of flagged sentences come from AI texts
// (each sentence takes the label of its text). Used by the style editor to mark AI-like sentences.
export function sentenceThreshold(docs, model, { precision = 0.85, sample = 1500 } = {}) {
  const scored = [];
  for (const d of docs.slice(0, sample)) for (const s of scoreSentences(d.text, model)) scored.push([s.score, d.label]);
  scored.sort((a, b) => b[0] - a[0]);
  let ai = 0;
  let best = scored.length ? scored[0][0] : 1;
  scored.forEach(([score, label], i) => {
    ai += label;
    if (i >= 50 && ai / (i + 1) >= precision) best = score;
  });
  return r4(best);
}

// Full pipeline for a corpus with a split column.
export function trainWithSplits(rows, { name = "Trained model", grid, log = () => {} } = {}) {
  const docs = prepare(rows);
  const part = (s) => docs.filter((d) => d.split === s);
  const train = part("train");
  const dev = part("dev");
  const test = part("test");
  if (!train.length || !test.length) throw new Error('The split column needs "train" and "test" rows.');

  const settings = grid || [
    { l2: 1e-5, keep: 8000 }, { l2: 1e-4, keep: 15000 }, { l2: 1e-5, keep: 25000, epochs: 12 },
  ];
  let best = { settings: settings[0], acc: -1 };
  if (dev.length && settings.length > 1) {
    for (const s of settings) {
      const m = fitFullModel(train, s);
      const acc = metrics(scoreDocs(dev, m), dev.map((d) => d.label)).accuracy;
      log(`  dev accuracy ${(acc * 100).toFixed(2)}% with l2=${s.l2}, phrases=${s.keep}`);
      if (acc > best.acc + 0.002 || (Math.abs(acc - best.acc) <= 0.002 && s.keep < best.settings.keep)) best = { settings: s, acc };
    }
  }
  const final = fitFullModel([...train, ...dev], { ...best.settings, name });
  if (final.ngrams) final.sentenceThreshold = sentenceThreshold(dev.length ? dev : train, final);
  const scores = scoreDocs(test, final);
  final.training = {
    rows: rows.length,
    train: train.length + dev.length,
    test: test.length,
    settings: best.settings,
    test_metrics: metrics(scores, test.map((d) => d.label)),
    by_domain: test[0].domain !== undefined ? breakdown(test, scores, "domain") : undefined,
    by_generator: test[0].generator !== undefined ? breakdown(test, scores, "generator") : undefined,
  };
  return { model: final, docs, test, scores };
}

// ---------- command line ----------

export const toModuleSource = (model) =>
  `// Built-in model for the AI text checker. Generated by scripts/ai-text-train.js; do not edit by hand.\n` +
  `// Trained on public research corpora: M4 (Wang et al., EACL 2024) and Ghostbuster (Verma et al., NAACL 2024, CC BY 3.0).\n` +
  `export const TRAINED_MODEL = ${JSON.stringify(model)};\n`;

function main(argv) {
  const args = argv.slice(2);
  const opt = (flag, fallback) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : fallback;
  };
  // One or more CSV files (for example the corpus and a file of Gemini texts).
  const files = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  const file = files[0];
  if (!file) {
    console.log("Usage: npm run ai-text-train -- data.csv [more.csv …] [--out model.json] [--name NAME] [--folds 5] [--l2 0.01]");
    process.exit(1);
  }
  const rows = files.flatMap((f) => loadRows(readFileSync(f, "utf8")));
  const out = opt("--out", "ai-text-model.json");
  const name = opt("--name", `Trained on ${file}`);

  let model;
  if (rows.some((r) => r.split)) {
    console.log(`Training with splits on ${rows.length} texts…`);
    ({ model } = trainWithSplits(rows, { name, log: console.log }));
    const t = model.training;
    const m = t.test_metrics;
    console.log(`Test set (${m.n} texts never seen in training): accuracy ${(m.accuracy * 100).toFixed(1)}%, AUC ${m.auc}, F1 ${m.f1}, false-positive rate ${(m.falsePositiveRate * 100).toFixed(1)}%`);
    if (t.by_domain) console.table(t.by_domain);
    if (t.by_generator) console.table(t.by_generator);
  } else {
    model = trainModel(rows, { folds: Number(opt("--folds", 5)), l2: Number(opt("--l2", 0.01)), name });
    const t = model.training;
    console.log(`Texts: ${t.rows} (${t.aiRows} AI, ${t.humanRows} human)`);
    console.log(`${t.cv.folds}-fold cross-validation: accuracy ${(t.cv.accuracy * 100).toFixed(1)}%, AUC ${t.cv.auc.toFixed(3)}`);
  }
  // A .js output is the built-in model for the /ai-tools/ page (public/ai-tools/model.js).
  writeFileSync(out, out.endsWith(".js") ? toModuleSource(model) : JSON.stringify(model));
  console.log("Style feature weights (standardised; + = more AI-like):");
  model.features
    .map((f, i) => [f, model.weights[i]])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .forEach(([f, w]) => console.log(`  ${w >= 0 ? "+" : ""}${w.toFixed(3)}  ${f}`));
  if (model.ngrams) {
    const top = Object.entries(model.ngrams).sort((a, b) => b[1] - a[1]);
    console.log(`Words/phrases kept: ${top.length}`);
    console.log("Most AI-indicative:   ", top.slice(0, 20).map(([g]) => g).join(" | "));
    console.log("Most human-indicative:", top.slice(-20).reverse().map(([g]) => g).join(" | "));
  }
  console.log(`Model saved to ${out}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
