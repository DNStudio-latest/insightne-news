// Builds a labelled training corpus (CSV) for the AI-text detector from two public research datasets:
//
//   M4 (Wang et al., EACL 2024) — https://github.com/mbzuai-nlp/M4
//     English domains: arxiv, peerread, reddit, wikipedia, wikihow; generators: ChatGPT, davinci, Cohere,
//     Dolly, BLOOMZ, FLAN-T5, LLaMA. Each record pairs a human text with a machine text from the same prompt.
//   Ghostbuster (Verma et al., NAACL 2024) — https://github.com/vivek3141/ghostbuster-data (CC BY 3.0)
//     Domains: student essays, creative writing (wp), Reuters news; generators: GPT-3.5, Claude.
//
//   node scripts/ai-text-corpus.js --m4 <M4 clone> --ghostbuster <ghostbuster-data clone> --out corpus.csv
//
// Output columns: label,text,domain,generator,group,split
// "group" ties a human text to the machine texts written from the same prompt; the train/dev/test split is
// made by group, so no prompt appears on both sides.

import { createReadStream, readdirSync, statSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";

const MAX_WORDS = 400;
const MIN_WORDS = 50;
const M4_DOMAINS = ["arxiv", "peerread", "reddit", "wikipedia", "wikihow"];

const hash = (s) => createHash("sha1").update(s).digest("hex");

// Deterministic split from the group id: 75% train, 10% dev, 15% test.
function splitFor(group) {
  const v = parseInt(hash(`split:${group}`).slice(0, 8), 16) / 0xffffffff;
  return v < 0.75 ? "train" : v < 0.85 ? "dev" : "test";
}

// Deterministic pseudo-random order, so sampling is reproducible.
const byHash = (key) => (a, b) => (hash(key + a.id) < hash(key + b.id) ? -1 : 1);

// Text that still carries the generation instruction is dropped (from both classes), so the model cannot
// learn the prompt instead of the writing.
const PROMPT_LEAK = [
  /use approximately \d+ (?:words|tokens)/i,
  /\b(?:headline|title|question|abstract)\s*:/i,
  /^(?:please )?(?:write|generate)\b/i,
  /wikihow article/i,
  /detailed response for/i,
];
export const looksLikePromptLeak = (t) => PROMPT_LEAK.some((re) => re.test(t));

const squash = (s) => String(s || "").replace(/\s+/g, " ").trim();

// Wikipedia human texts are whole articles; the machine texts are lead sections. Keep the human lead only:
// stop at the first heading-like line (short, no closing punctuation) once some text has been collected.
export function leadSection(text) {
  const kept = [];
  let words = 0;
  for (const line of String(text || "").split(/\n+/)) {
    const t = line.trim();
    if (!t) continue;
    const n = t.split(/\s+/).length;
    const heading = n <= 6 && !/[.!?:;"”)]$/.test(t);
    if (heading && words >= 40) break;
    if (heading) continue;
    kept.push(t);
    words += n;
  }
  return kept.join("\n");
}

// Removes formatting differences that would let a model tell the classes apart for the wrong reason.
export function clean(text, { prompt = "" } = {}) {
  // Ghostbuster files sometimes hold GPT-2 byte tokens: Ġ = space, Ċ = newline.
  let t = String(text || "").replace(/Ġ/g, " ").replace(/Ċ/g, "\n");
  const p = squash(prompt);
  if (p.length > 15) t = squash(t).split(p).join(" "); // prompt echoed by the model
  t = t
    .replace(/^\s*(?:Write|Generate) an abstract for [^\n]*?Abstract:\s*/i, "")
    .replace(/^\s*Please write a peer review[^\n]*\n?/gim, "")
    .replace(/^\s*How to [^\n]{0,120}\n/, "") // WikiHow title line (machine texts only had it)
    .replace(/^\s*(?:Sure|Certainly|Of course)[,!.][^\n]*\n/i, "");
  t = squash(t);
  const words = t.split(" ");
  if (words.length > MAX_WORDS) t = words.slice(0, MAX_WORDS).join(" ");
  return t;
}

const wordCount = (t) => (t ? t.split(" ").length : 0);

async function readJsonl(path) {
  const rows = [];
  const rl = createInterface({ input: createReadStream(path) });
  for await (const line of rl) {
    try { rows.push(JSON.parse(line)); } catch { /* skip malformed line */ }
  }
  return rows;
}

async function m4Rows(dir, perFile) {
  const out = [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".jsonl") && M4_DOMAINS.includes(f.split("_")[0]));
  for (const file of files) {
    const [domain, rawGen] = file.replace(".jsonl", "").split("_");
    const generator = rawGen.toLowerCase().replace(/2$/, "");
    const records = (await readJsonl(join(dir, file))).map((r, i) => ({ ...r, id: `${file}:${i}` }));
    let taken = 0;
    for (const r of records.sort(byHash("m4"))) {
      if (taken >= perFile) break;
      const human = clean(domain === "wikipedia" ? leadSection(r.human_text ?? r.text) : r.human_text ?? r.text);
      const machine = clean(r.machine_text, { prompt: r.prompt });
      if (wordCount(machine) < MIN_WORDS || looksLikePromptLeak(machine)) continue;
      const group = `m4:${domain}:${hash(human.slice(0, 300) || r.id)}`;
      out.push({ label: "ai", text: machine, domain, generator, group });
      if (wordCount(human) >= MIN_WORDS && !looksLikePromptLeak(human)) out.push({ label: "human", text: human, domain, generator: "human", group });
      taken += 1;
    }
  }
  return out;
}

function listTxt(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listTxt(p) : name.endsWith(".txt") ? [p] : [];
  });
}

function ghostbusterRows(root, perSource) {
  const out = [];
  for (const domain of ["essay", "wp", "reuter"]) {
    for (const source of ["human", "gpt", "claude"]) {
      const dir = join(root, domain, source);
      const files = listTxt(dir).map((p) => ({ id: p, p })).sort(byHash(`gb:${domain}:${source}`));
      let taken = 0;
      for (const { p } of files) {
        if (taken >= perSource) break;
        const text = clean(readFileSync(p, "utf8"));
        if (wordCount(text) < MIN_WORDS || looksLikePromptLeak(text)) continue;
        out.push({
          label: source === "human" ? "human" : "ai",
          text,
          domain: `gb-${domain}`,
          generator: source,
          group: `gb:${domain}:${relative(dir, p)}`,
        });
        taken += 1;
      }
    }
  }
  return out;
}

// Keeps each domain balanced: as many human texts as machine texts, and no duplicate texts.
function balance(rows) {
  const seen = new Set();
  const unique = rows.filter((r) => {
    const k = hash(r.text);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  const out = [];
  for (const domain of new Set(unique.map((r) => r.domain))) {
    const ai = unique.filter((r) => r.domain === domain && r.label === "ai");
    const human = unique.filter((r) => r.domain === domain && r.label === "human");
    const n = Math.min(ai.length, human.length);
    const pick = (xs) => xs.map((r) => ({ ...r, id: hash(r.text) })).sort(byHash("bal")).slice(0, n);
    out.push(...pick(ai), ...pick(human));
  }
  return out;
}

const csvField = (v) => `"${String(v).replace(/"/g, '""')}"`;

async function main() {
  const args = process.argv.slice(2);
  const opt = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  const m4 = opt("--m4");
  const gb = opt("--ghostbuster");
  const out = opt("--out", "ai-text-corpus.csv");
  if (!m4 && !gb) {
    console.log("Usage: node scripts/ai-text-corpus.js --m4 <dir> --ghostbuster <dir> [--per-file 400] [--per-source 900] [--out corpus.csv]");
    process.exit(1);
  }
  const rows = [
    ...(m4 ? await m4Rows(join(m4, "data"), Number(opt("--per-file", 400))) : []),
    ...(gb ? ghostbusterRows(gb, Number(opt("--per-source", 900))) : []),
  ];
  const final = balance(rows).map((r) => ({ ...r, split: splitFor(r.group) }));
  const header = "label,text,domain,generator,group,split";
  const body = final.map((r) => [r.label, r.text, r.domain, r.generator, r.group, r.split].map(csvField).join(","));
  writeFileSync(out, [header, ...body].join("\n") + "\n");

  const tally = {};
  for (const r of final) {
    const k = `${r.domain}`;
    tally[k] ??= { ai: 0, human: 0 };
    tally[k][r.label] += 1;
  }
  console.log(`Saved ${final.length} texts to ${out}`);
  console.table(tally);
  const splits = {};
  for (const r of final) splits[r.split] = (splits[r.split] || 0) + 1;
  console.log("Split sizes:", splits);
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop())) main();
