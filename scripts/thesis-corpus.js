// Builds the labelled training corpus (CSV) for the PhD thesis AI-text checker from public research datasets
// of academic writing. All of them can be cloned from GitHub:
//
//   GPABench2 (Liu et al., ACM CCS 2024, "On the Detectability of ChatGPT Content") — github.com/liuzey/CheckGPT
//     50,000 abstracts per discipline: humanities and social sciences (HSS), computer science (CS), physics (PHX).
//     Each human abstract has three ChatGPT versions: written from the title (task 1), the second half completed
//     from the first half (task 2) and the whole abstract polished (task 3).
//   CHEAT (Yu et al., IEEE Trans. Big Data 2025) — github.com/botianzhe/CHEAT
//     15,395 IEEE abstracts with ChatGPT generation, polish and fusion (human-AI mix) versions.
//   M4 (Wang et al., EACL 2024) — github.com/mbzuai-nlp/M4: arXiv abstracts and PeerRead peer reviews,
//     seven AI models.
//   DetectRL (Wu et al., NeurIPS 2024 Datasets) — github.com/NLP2CT/DetectRL: 2,800 arXiv abstracts written by
//     ChatGPT, Google PaLM, Claude-instant and Llama-2-70b, plus AI-polished and paraphrased versions.
//   MixSet (Zhang et al., 2024) — github.com/Dongping-Chen/MixSet: human text revised by AI and AI text
//     "humanised" by AI. Used only as a hard test, never for training.
//
//   node scripts/thesis-corpus.js --gpabench <CheckGPT clone> --cheat <CHEAT clone> --m4 <M4 clone> \
//     --detectrl <DetectRL clone> --mixset <MixSet clone> --out thesis-corpus.csv [--robust-out thesis-robust.csv]
//
// Columns: label,text,domain,generator,task,group,split. "task" is generate / complete / polish / fusion /
// human. Each human abstract and the AI texts made from it share a group, and the train/dev/test split is made by
// group, so no abstract is on both sides. Each human text is cut to about the length of its AI partner, so the
// model cannot learn length instead of style (GPABench2 human abstracts are twice as long as ChatGPT's).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { clean, looksLikePromptLeak, m4Rows, wordCount } from "./ai-text-corpus.js";

const MIN_WORDS = 60;
const hash = (s) => createHash("sha1").update(s).digest("hex");
const unit = (key) => parseInt(hash(key).slice(0, 8), 16) / 0xffffffff;

// Deterministic split from the group id: 75% train, 10% dev, 15% test.
export function splitFor(group) {
  const v = unit(`split:${group}`);
  return v < 0.75 ? "train" : v < 0.85 ? "dev" : "test";
}

// The same abstract from two datasets gets the same group (letters only, so spacing does not matter).
export const abstractKey = (text) => hash(String(text).toLowerCase().replace(/[^a-z]/g, "").slice(0, 160));

// Formatting that only one side carries, which a model would otherwise learn instead of style: publisher
// boilerplate and arXiv notes (human), LaTeX (mostly human), words split at line ends ("resonant ly", human) and
// the chatbot's preamble ("Here is the abstract…", AI).
export function cleanAcademic(text) {
  return clean(
    String(text || "")
      .replace(/^\s*(?:sure|certainly|of course)[,!.]?\s*/i, "")
      .replace(/^\s*(?:here is|here's|below is|here are)\b[^:\n]{0,140}?:\s*/i, "")
      .replace(/^\s*title\s*:[^\n]*\n/i, "")
      .replace(/^\s*(?:abstract|summary)\s*[:.—-]?\s*/i, "")
      .replace(/\$\$?[^$]{0,200}\$\$?/g, " ")
      .replace(/\\(?:emph|textit|textbf|cite|ref|url)\{([^}]*)\}/g, "$1")
      .replace(/\\[a-zA-Z]+\*?(?:\{[^}]*\})?/g, " ")
      .replace(/[([]?\b(?:abridged|shortened|truncated)\b[)\]]?\.?/gi, " ")
      .replace(/(\p{L}{3,})-?\s(ly)\b/gu, "$1$2")
      .replace(/(?:©|\(c\)\s*\d{4}|copyright\s*(?:©\s*)?\d{4})[\s\S]{0,200}$/i, " ")
      .replace(/\b(?:all rights reserved|published by [A-Z][^.]{0,60})\.?/gi, " ")
      .replace(/\s*(?:keywords?|key words)\s*:.*$/i, "")
      .replace(/https?:\/\/\S+/g, " ")
  );
}

// Cuts a text at a sentence end near `words` words (never below MIN_WORDS), so the human and AI texts of a pair
// have about the same length.
export function cutToLength(text, words) {
  const target = Math.max(MIN_WORDS, Math.round(words * 1.1));
  if (wordCount(text) <= target) return text;
  const sentences = text.match(/[^.!?]+[.!?]+(?:["”’)]+)?\s*|[^.!?]+$/g) || [text];
  let out = "";
  for (const s of sentences) {
    if (out && wordCount((out + s).trim()) > target) break;
    out += s;
  }
  out = out.trim();
  return wordCount(out) >= MIN_WORDS ? out : text.split(" ").slice(0, target).join(" ");
}

// arXiv human abstracts in DetectRL lost the space at each line break ("ispresented", "themodel"). Rejoined
// words are split again where both halves are common words in the corpus; otherwise the model would learn
// "broken words mean human".
export function makeRepairer(texts) {
  const freq = new Map();
  for (const t of texts) for (const w of t.toLowerCase().match(/[a-z]+/g) || []) freq.set(w, (freq.get(w) || 0) + 1);
  const common = (w) => (freq.get(w) || 0) >= 20 && (w.length > 1 || w === "a");
  // Only splits where one half is a short function word ("ofthe", "ispresented", "themodel"), so a rare
  // technical term is never cut into two ordinary words.
  const FUNCTION = new Set("a an the of in on to for and or is are was be by as at from with that this we our it its".split(" "));
  return (text) =>
    text.replace(/[A-Za-z]{5,}/g, (word) => {
      const lower = word.toLowerCase();
      if ((freq.get(lower) || 0) >= 5) return word;
      let best = null;
      for (let i = 1; i < word.length; i++) {
        const a = lower.slice(0, i);
        const b = lower.slice(i);
        if ((FUNCTION.has(a) || FUNCTION.has(b)) && common(a) && common(b)) {
          const score = Math.min(freq.get(a), freq.get(b));
          if (!best || score > best.score) best = { i, score };
        }
      }
      return best ? `${word.slice(0, best.i)} ${word.slice(best.i)}` : word;
    });
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const readJsonl = (p) => readFileSync(p, "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });

// One human text and one AI text per abstract. Which AI version is used rotates (by hash) through `tasks`,
// with the given shares, so the corpus stays balanced and every pair shares a topic.
function pick(key, tasks) {
  const v = unit(`task:${key}`);
  let acc = 0;
  for (const [task, share] of tasks) { acc += share; if (v < acc) return task; }
  return tasks[tasks.length - 1][0];
}

function pair(out, { human, ai, domain, generator, task, group }) {
  const a = cleanAcademic(ai);
  let h = cleanAcademic(human);
  if (wordCount(a) < MIN_WORDS || looksLikePromptLeak(a)) return;
  h = cutToLength(h, wordCount(a));
  if (wordCount(h) < MIN_WORDS || looksLikePromptLeak(h)) return;
  out.push({ label: "ai", text: a, domain, generator, task, group });
  out.push({ label: "human", text: h, domain, generator: "human", task: "human", group });
}

export function gpabenchRows(root, perDiscipline) {
  const out = [];
  for (const [disc, n] of Object.entries(perDiscipline)) {
    const tasks = disc === "HSS" ? [["generate", 0.5], ["complete", 0.2], ["polish", 0.3]] : [["generate", 0.6], ["polish", 0.4]];
    const files = { generate: "TASK1", complete: "TASK2", polish: "TASK3" };
    const load = (t, who) => {
      const p = join(root, "GPABenchmark", `${disc}_${files[t]}`, `${who}.json`);
      return existsSync(p) ? readJson(p) : null;
    };
    const human = load("generate", "hum");
    const ai = Object.fromEntries(tasks.map(([t]) => [t, load(t, "gpt")]));
    if (!human) continue;
    const keys = Object.keys(human).sort((a, b) => (hash(`gp:${a}`) < hash(`gp:${b}`) ? -1 : 1));
    let taken = 0;
    for (const key of keys) {
      if (taken >= n) break;
      const task = pick(`${disc}:${key}`, tasks);
      const text = ai[task]?.[key];
      if (!text) continue;
      const before = out.length;
      pair(out, { human: human[key], ai: text, domain: `gpab-${disc.toLowerCase()}`, generator: "chatgpt", task, group: `abs:${abstractKey(human[key])}` });
      if (out.length > before) taken += 1;
    }
  }
  return out;
}

export function cheatRows(root, n) {
  const dir = join(root, "data");
  const human = new Map(readJsonl(join(dir, "ieee-init.jsonl")).map((r) => [r.id, r.abstract]));
  const versions = {
    generate: new Map(readJsonl(join(dir, "ieee-chatgpt-generation.jsonl")).map((r) => [r.id, r.abstract])),
    polish: new Map(readJsonl(join(dir, "ieee-chatgpt-polish.jsonl")).map((r) => [r.id, r.abstract])),
    fusion: new Map(readJsonl(join(dir, "ieee-chatgpt-fusion.jsonl")).map((r) => [r.id, r.abstract])),
  };
  const out = [];
  let taken = 0;
  for (const id of [...human.keys()].sort((a, b) => (hash(`ch:${a}`) < hash(`ch:${b}`) ? -1 : 1))) {
    if (taken >= n) break;
    let task = pick(`cheat:${id}`, [["generate", 0.45], ["polish", 0.35], ["fusion", 0.2]]);
    if (!versions[task].has(id)) task = "generate";
    const text = versions[task].get(id);
    if (!text) continue;
    const before = out.length;
    pair(out, { human: human.get(id), ai: text, domain: "ieee", generator: "chatgpt", task, group: `abs:${abstractKey(human.get(id))}` });
    if (out.length > before) taken += 1;
  }
  return out;
}

export function detectrlRows(root, { robust = [] } = {}) {
  const rows = readJson(join(root, "Benchmark", "Original_Dataset", "arxiv_2800.json"));
  const repair = makeRepairer(rows.flatMap((r) => [r.direct_prompt, r.paraphrase_polish_human].filter(Boolean)));
  const out = [];
  for (const r of rows) {
    const human = repair(String(r.abstract || ""));
    const generator = String(r.llm_type || "unknown").toLowerCase();
    const task = pick(`detectrl:${r.id}:${generator}`, [["generate", 0.7], ["polish", 0.3]]);
    const ai = task === "polish" ? r.paraphrase_polish_human : r.direct_prompt;
    const group = `abs:${abstractKey(human)}`;
    pair(out, { human, ai, domain: "arxiv", generator, task, group });
    // AI text rewritten by a paraphrasing model (DIPPER): a test of text put through a "humaniser".
    const dipper = cleanAcademic(r.paraphrase_dipper_llm);
    if (wordCount(dipper) >= MIN_WORDS) robust.push({ label: "ai", text: dipper, domain: "arxiv", generator, task: "paraphrase-dipper", group, split: "robust" });
  }
  return out;
}

async function m4Academic(root, perFile) {
  const rows = (await m4Rows(join(root, "data"), perFile)).filter((r) => r.domain === "arxiv" || r.domain === "peerread");
  // Re-pair by group and cut each human text to its partner's length.
  const byGroup = new Map();
  for (const r of rows) {
    if (!byGroup.has(r.group)) byGroup.set(r.group, { ai: [], human: null });
    if (r.label === "ai") byGroup.get(r.group).ai.push(r); else byGroup.get(r.group).human = r;
  }
  const out = [];
  for (const { ai, human } of byGroup.values()) {
    if (!human) continue;
    for (const a of ai) {
      const group = human.domain === "arxiv" ? `abs:${abstractKey(human.text)}` : `m4:${human.group}`;
      pair(out, { human: human.text, ai: a.text, domain: human.domain, generator: a.generator.toLowerCase(), task: "generate", group });
    }
  }
  return out;
}

// MixSet: every file except the plain originals, labelled as the dataset labels it (AI-revised human text counts
// as AI-touched; human-revised AI text too). Only for testing.
export function mixsetRows(root) {
  const dir = join(root, "data", "MixSet");
  const out = [];
  for (const file of ["Mixset_train.json", "Mixset_test.json"]) {
    const p = join(dir, file);
    if (!existsSync(p)) continue;
    for (const r of readJson(p)) {
      const text = cleanAcademic(r.revised);
      if (wordCount(text) < MIN_WORDS) continue;
      out.push({
        label: r.binary === "HWT" ? "human" : "ai",
        text,
        domain: `mixset-${String(r.category || "other").toLowerCase()}`,
        generator: String(r.mixset_category || "").split("_")[0].toLowerCase() || "unknown",
        task: String(r.mixset_category || "").replace(/^[^_]+_/, "").toLowerCase(),
        group: `mixset:${r.id}`,
        split: "robust",
      });
    }
  }
  return out;
}

// Removes duplicates; a text that appears in two groups keeps the first.
function dedupe(rows) {
  const seen = new Set();
  return rows.filter((r) => {
    const k = hash(r.text);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// As many AI texts as human texts in each domain (M4 has several AI texts for one human text).
export function balance(rows) {
  const out = [];
  for (const domain of new Set(rows.map((r) => r.domain))) {
    const ai = rows.filter((r) => r.domain === domain && r.label === "ai");
    const human = rows.filter((r) => r.domain === domain && r.label === "human");
    const n = Math.min(ai.length, human.length);
    const keep = (xs) => xs.map((r) => [hash(`bal:${r.text}`), r]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(0, n).map(([, r]) => r);
    out.push(...keep(ai), ...keep(human));
  }
  return out;
}

const csvField = (v) => `"${String(v).replace(/"/g, '""')}"`;
const COLUMNS = ["label", "text", "domain", "generator", "task", "group", "split"];
export const toCsv = (rows) => [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => csvField(r[c] ?? "")).join(","))].join("\n") + "\n";

async function main() {
  const args = process.argv.slice(2);
  const opt = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  const out = opt("--out", "thesis-corpus.csv");
  const robustOut = opt("--robust-out", out.replace(/\.csv$/, "") + "-robust.csv");
  const robust = [];
  const rows = [];
  if (opt("--gpabench")) rows.push(...gpabenchRows(opt("--gpabench"), { HSS: Number(opt("--hss", 9000)), CS: Number(opt("--cs", 2500)), PHX: Number(opt("--phx", 2500)) }));
  if (opt("--cheat")) rows.push(...cheatRows(opt("--cheat"), Number(opt("--ieee", 3000))));
  if (opt("--detectrl")) rows.push(...detectrlRows(opt("--detectrl"), { robust }));
  if (opt("--m4")) rows.push(...(await m4Academic(opt("--m4"), Number(opt("--per-file", 450)))));
  if (!rows.length) {
    console.log("Usage: node scripts/thesis-corpus.js --gpabench <dir> --cheat <dir> --m4 <dir> --detectrl <dir> --mixset <dir> [--out thesis-corpus.csv]");
    process.exit(1);
  }
  if (opt("--mixset")) robust.push(...mixsetRows(opt("--mixset")));
  // Words run together at line breaks ("ofthe", "inthe") are split again in every human text.
  const repair = makeRepairer(rows.filter((r) => r.label === "ai").map((r) => r.text));
  for (const r of rows) if (r.label === "human") r.text = repair(r.text);
  const final = balance(dedupe(rows)).map((r) => ({ ...r, split: splitFor(r.group) }));
  // Robust texts whose abstract is in the training split would make the test too easy: keep only test groups.
  const testGroups = new Set(final.filter((r) => r.split === "test").map((r) => r.group));
  const robustFinal = dedupe(robust).filter((r) => r.group.startsWith("mixset:") || testGroups.has(r.group));
  writeFileSync(out, toCsv(final));
  writeFileSync(robustOut, toCsv(robustFinal));

  const tally = {};
  for (const r of final) {
    tally[r.domain] ??= { ai: 0, human: 0 };
    tally[r.domain][r.label] += 1;
  }
  console.log(`Saved ${final.length} texts to ${out} and ${robustFinal.length} hard-test texts to ${robustOut}`);
  console.table(tally);
  const by = (key) => final.reduce((m, r) => ({ ...m, [r[key]]: (m[r[key]] || 0) + 1 }), {});
  console.log("Splits:", by("split"));
  console.log("Tasks:", by("task"));
  console.log("Generators:", by("generator"));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
