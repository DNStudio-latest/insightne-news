// Trains the academic AI-text model for the PhD thesis checker and tests it in the ways that matter for a thesis.
//
//   node scripts/thesis-train.js thesis-corpus.csv [--robust thesis-corpus-robust.csv] \
//     [--out public/ai-tools/model-academic.js] [--report docs/thesis-ai-eval.json] [--quick]
//
// The corpus comes from scripts/thesis-corpus.js. Reported (all on texts the model never saw):
//   - the test split overall, by discipline, by AI model and by kind of AI use (written, completed, polished);
//   - the website's news model on the same texts, to show why academic writing needs its own model;
//   - an unseen discipline: trained without the humanities and social sciences, tested on them;
//   - unseen AI models (Claude, PaLM, Llama 2) and an unseen kind of use (polishing);
//   - hard tests: AI text run through a paraphrasing "humaniser" (DIPPER) and MixSet's revised texts.
// The "AI-like" threshold is set so that no more than 2% of human test-set-like texts (dev split) are flagged.

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { loadRows, prepare, fitFullModel, scoreDocs, metrics, breakdown, sentenceThreshold } from "./ai-text-train.js";
import { TRAINED_MODEL } from "../public/ai-tools/model.js";

export const SETTINGS = { l2: 1e-5, keep: 25000, epochs: 12 };
const r4 = (v) => Math.round(v * 1e4) / 1e4;

// The lowest score at which at most `maxFpr` of human texts are flagged.
export function thresholdForFpr(scores, labels, maxFpr = 0.02) {
  const human = scores.filter((_, i) => labels[i] === 0).sort((a, b) => b - a);
  if (!human.length) return 0.7;
  const k = Math.floor(human.length * maxFpr);
  return r4(Math.min(0.99, Math.max(0.5, human[k] ?? 0.5)));
}

// Accuracy, false-positive rate and share caught at a given threshold.
export function atThreshold(scores, labels, th) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  scores.forEach((s, i) => {
    const flagged = s >= th;
    if (labels[i] === 1) flagged ? tp++ : fn++;
    else flagged ? fp++ : tn++;
  });
  const n = scores.length;
  return { n, threshold: th, accuracy: r4((tp + tn) / n), falsePositiveRate: r4(fp / Math.max(1, fp + tn)), caught: r4(tp / Math.max(1, tp + fn)) };
}

const pct = (x) => `${(x * 100).toFixed(1)}%`;

function main() {
  const args = process.argv.slice(2);
  const opt = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  const file = args.find((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
  if (!file) {
    console.log("Usage: node scripts/thesis-train.js thesis-corpus.csv [--robust robust.csv] [--out model.js] [--report report.json] [--quick]");
    process.exit(1);
  }
  const quick = args.includes("--quick");
  const out = opt("--out", "public/ai-tools/model-academic.js");
  const reportFile = opt("--report", "docs/thesis-ai-eval.json");
  const docs = prepare(loadRows(readFileSync(file, "utf8")));
  const robust = opt("--robust") ? prepare(loadRows(readFileSync(opt("--robust"), "utf8"))) : [];
  const part = (s) => docs.filter((d) => d.split === s);
  const train = part("train");
  const dev = part("dev");
  const test = part("test");
  const labels = (xs) => xs.map((d) => d.label);
  const log = (k, m) => console.log(`${k.padEnd(46)} acc ${pct(m.accuracy)}  AUC ${m.auc ?? "-"}  FPR ${pct(m.falsePositiveRate ?? 0)}  caught ${pct(m.recall ?? m.caught ?? 0)}  n=${m.n}`);
  const report = { corpus: { texts: docs.length, train: train.length, dev: dev.length, test: test.length }, createdAt: new Date().toISOString() };

  // 1. Choose the settings on the dev split.
  const grid = quick ? [SETTINGS] : [{ l2: 1e-5, keep: 15000 }, SETTINGS, { l2: 3e-6, keep: 40000, epochs: 12 }];
  let best = { s: grid[0], acc: -1 };
  for (const s of grid) {
    const m = fitFullModel(train, s);
    const acc = metrics(scoreDocs(dev, m), labels(dev)).accuracy;
    console.log(`dev accuracy ${pct(acc)} with l2=${s.l2}, phrases=${s.keep}`);
    if (acc > best.acc + 0.002) best = { s, acc };
  }
  report.settings = best.s;

  // 2. The final model: trained on train only, so dev can set the threshold fairly; then refit on train + dev.
  const probe = fitFullModel(train, best.s);
  const high = thresholdForFpr(scoreDocs(dev, probe), labels(dev), 0.02);
  const model = fitFullModel([...train, ...dev], { ...best.s, name: "Academic writing (GPABench2, CHEAT, M4, DetectRL)" });
  model.thresholds = { low: 0.3, high };
  model.sentenceThreshold = sentenceThreshold(dev, model, { precision: 0.9 });
  const scores = scoreDocs(test, model);
  const m = metrics(scores, labels(test));
  log("Academic model, test split (threshold 0.5)", m);
  const strict = atThreshold(scores, labels(test), high);
  console.log(`At the 'AI-like' threshold ${high}: accuracy ${pct(strict.accuracy)}, human texts flagged ${pct(strict.falsePositiveRate)}, AI texts caught ${pct(strict.caught)}`);
  report.test = m;
  report.test_at_ai_threshold = strict;
  report.by_domain = breakdown(test, scores, "domain");
  report.by_generator = breakdown(test, scores, "generator");
  report.by_task = breakdown(test, scores, "task");
  console.table(report.by_domain);
  console.table(report.by_task);
  console.table(report.by_generator);

  // 3. The website's news model (M4 + Ghostbuster) on the same academic texts.
  report.news_model_on_academic = metrics(scoreDocs(test, TRAINED_MODEL), labels(test));
  log("News model (website), same test texts", report.news_model_on_academic);
  const hss = test.filter((d) => d.domain === "gpab-hss");
  report.news_model_on_hss = metrics(scoreDocs(hss, TRAINED_MODEL), labels(hss));
  log("News model on humanities & social sciences", report.news_model_on_hss);

  const run = (name, tr, te) => {
    const mm = fitFullModel(tr, best.s);
    const r = metrics(scoreDocs(te, mm), labels(te));
    log(name, r);
    return r;
  };
  const trainAll = [...train, ...dev];
  if (!quick) {
    // 4. Unseen discipline, unseen AI models, unseen kind of use.
    report.unseen_domain = {};
    for (const dom of ["gpab-hss", "ieee", "arxiv"]) {
      report.unseen_domain[dom] = run(`Unseen discipline: ${dom}`, trainAll.filter((d) => d.domain !== dom), test.filter((d) => d.domain === dom));
    }
    report.unseen_generator = {};
    for (const gen of ["claude-instant", "google-palm", "llama-2-70b", "cohere", "dolly"]) {
      const te = test.filter((d) => d.generator === gen || d.label === 0);
      if (te.filter((d) => d.label === 1).length < 20) continue;
      report.unseen_generator[gen] = run(`Unseen AI model: ${gen}`, trainAll.filter((d) => d.generator !== gen), te);
    }
    report.unseen_task = {};
    report.unseen_task.polish = run("Unseen use: AI polishing of human text", trainAll.filter((d) => d.task !== "polish"), test.filter((d) => d.task === "polish" || d.label === 0));
  }

  // 5. Hard tests.
  if (robust.length) {
    const rs = scoreDocs(robust, model);
    report.robust = {
      by_task: breakdown(robust, rs, "task"),
      dipper_at_ai_threshold: atThreshold(rs.filter((_, i) => robust[i].task === "paraphrase-dipper"), robust.filter((d) => d.task === "paraphrase-dipper").map((d) => d.label), high),
    };
    console.log("Hard tests (share labelled correctly, threshold 0.5):");
    console.table(report.robust.by_task);
  }

  model.training = {
    rows: docs.length,
    train: trainAll.length,
    test: test.length,
    settings: best.s,
    test_metrics: m,
    at_ai_threshold: strict,
    by_domain: report.by_domain,
  };
  writeFileSync(out, out.endsWith(".js")
    ? `// Academic-writing model for the PhD thesis checker. Generated by scripts/thesis-train.js; do not edit by hand.\n` +
      `// Trained on public research corpora: GPABench2 (Liu et al., ACM CCS 2024), CHEAT (Yu et al., IEEE TBD 2025),\n` +
      `// M4 (Wang et al., EACL 2024) and DetectRL (Wu et al., NeurIPS 2024). See docs/10-THESIS-AI-TOOLS.md.\n` +
      `export const ACADEMIC_MODEL = ${JSON.stringify(model)};\n`
    : JSON.stringify(model));
  writeFileSync(reportFile, JSON.stringify(report, null, 2) + "\n");
  const top = Object.entries(model.ngrams).sort((a, b) => b[1] - a[1]);
  console.log("Most AI-indicative:   ", top.slice(0, 30).map(([g]) => g).join(" | "));
  console.log("Most human-indicative:", top.slice(-30).reverse().map(([g]) => g).join(" | "));
  console.log("Style weights:", model.features.map((f, i) => `${f} ${model.weights[i]}`).join(", "));
  console.log(`Saved ${out} and ${reportFile}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
