// Adds Google Gemini texts to the AI-text detector's corpus, so the detector learns Gemini's writing.
//
// For each chosen human text in the corpus, Gemini is asked to write a text of the same genre, length and
// topic. The Gemini text gets the same group and train/dev/test split as the human text, so the test stays
// fair (no topic appears on both sides).
//
// A) Automatic, with a Gemini API key (free from aistudio.google.com; a Gemini app subscription does not
//    include API access). The key is read from GEMINI_API_KEY.
//      node scripts/ai-text-gemini.js corpus.csv --out gemini.csv [--per-domain 150] [--model gemini-flash-latest]
//    Progress is saved after every text: run the same command again to continue (for example the next day,
//    when the free daily limit resets).
//
// B) By hand, in the Gemini app (gemini.google.com):
//      node scripts/ai-text-gemini.js corpus.csv --prompts-out gemini-prompts.csv [--per-domain 10]
//    Open the file in Google Sheets or Excel, paste each prompt into Gemini, and paste Gemini's reply into the
//    "answer" column of the same row (rows left empty are skipped). Save as CSV, then:
//      node scripts/ai-text-gemini.js corpus.csv --import gemini-prompts.csv --out gemini.csv
//
// Then train on both files:   npm run ai-text-train -- corpus.csv gemini.csv --out model.json

import { readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { parseCsv } from "./ai-text-train.js";
import { clean, looksLikePromptLeak } from "./ai-text-corpus.js";
import { createGeminiCaller } from "../lib/gemini.js";

const GENRES = {
  arxiv: "the abstract of a scientific research paper",
  peerread: "a peer review of a machine-learning conference paper, as a reviewer would write it",
  reddit: "an answer to a question on Reddit's \"Explain Like I'm Five\" forum",
  wikipedia: "the opening section of a Wikipedia article",
  wikihow: "a WikiHow how-to article",
  "gb-essay": "a university student's essay",
  "gb-wp": "a short story",
  "gb-reuter": "a Reuters news report",
};

const HEADER = "label,text,domain,generator,group,split";
const csvField = (v) => `"${String(v).replace(/"/g, '""')}"`;
const toCsvLine = (r) => [r.label, r.text, r.domain, r.generator, r.group, r.split].map(csvField).join(",");
const hash = (s) => createHash("sha1").update(s).digest("hex");

// Rows with their group column (loadRows does not keep it). The file is parsed once.
function loadWithGroups(csvText) {
  const [header, ...body] = parseCsv(csvText.replace(/^\uFEFF/, ""));
  const cols = header.map((h) => h.trim().toLowerCase());
  const col = (name) => cols.indexOf(name);
  if (col("label") < 0 || col("text") < 0) throw new Error('The CSV needs "label" and "text" columns.');
  const get = (r, name) => (col(name) >= 0 ? (r[col(name)] || "").trim() : "");
  return body.map((r, i) => {
    const raw = get(r, "label").toLowerCase();
    return {
      label: ["ai", "1", "machine", "llm", "generated"].includes(raw) ? 1 : 0,
      text: r[col("text")] || "",
      domain: get(r, "domain").toLowerCase(),
      split: get(r, "split").toLowerCase(),
      group: get(r, "group") || `row:${i}`,
    };
  });
}

// Human texts to pair with Gemini texts: the same number from each genre, chosen in a fixed order.
export function pickHumanTexts(rows, perDomain) {
  const out = [];
  for (const domain of Object.keys(GENRES)) {
    const pool = rows
      .filter((r) => r.label === 0 && r.domain === domain)
      .map((r) => [hash(`gemini:${r.text}`), r])
      .sort((a, b) => (a[0] < b[0] ? -1 : 1));
    out.push(...pool.slice(0, perDomain).map(([, r]) => r));
  }
  return out;
}

export function promptFor(row) {
  const words = row.text.split(/\s+/).length;
  const target = Math.max(80, Math.min(400, Math.round(words / 10) * 10));
  const excerpt = row.text.split(/\s+/).slice(0, 40).join(" ");
  return [
    `Write ${GENRES[row.domain] || "a text"} of about ${target} words.`,
    "It should be about the same subject as the excerpt below, but do not copy, quote or continue it: write your own text.",
    "Reply with the text only: no title, no headings, no bullet points, no notes before or after.",
    "",
    `Excerpt: """${excerpt}…"""`,
  ].join("\n");
}

// Gemini sometimes adds Markdown; the corpus is plain text.
export function tidy(text) {
  return clean(
    String(text || "")
      .replace(/^#+\s.*$/gm, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/^\s*[-*]\s+/gm, "")
  );
}

function asRow(human, text, model) {
  const t = tidy(text);
  if (t.split(" ").length < 50 || looksLikePromptLeak(t)) return null;
  return { label: "ai", text: t, domain: human.domain, generator: "gemini", group: human.group, split: human.split || "train", model };
}

const idFor = (human) => hash(`id:${human.group}:${human.text}`).slice(0, 10);

export async function generateWithApi(rows, { out, perDomain, model, gapMs, generate, log = console.log }) {
  const done = new Set();
  if (existsSync(out)) {
    for (const r of loadWithGroups(readFileSync(out, "utf8"))) done.add(r.group);
  } else {
    writeFileSync(out, `${HEADER}\n`);
  }
  generate ??= createGeminiCaller({ model, json: false, temperature: 0.9, gapMs, maxOutputTokens: 1500 });
  const todo = pickHumanTexts(rows, perDomain).filter((h) => !done.has(h.group));
  log(`${done.size} Gemini texts already saved; ${todo.length} to write with ${model}.`);
  let saved = 0;
  let skipped = 0;
  for (const human of todo) {
    let text;
    try {
      text = await generate("You are a skilled writer.", promptFor(human));
    } catch (err) {
      log(`Stopped: ${err.message}`);
      if (/daily limit|429|quota/i.test(err.message)) log("The daily limit is used up. Run the same command again tomorrow to continue.");
      break;
    }
    const row = asRow(human, text, model);
    if (!row) { skipped++; continue; }
    appendFileSync(out, `${toCsvLine(row)}\n`);
    saved++;
    if (saved % 10 === 0) log(`  ${saved} saved…`);
  }
  log(`Saved ${saved} new Gemini texts to ${out}${skipped ? ` (${skipped} answers were too short or off-format and were left out)` : ""}.`);
  return { saved, skipped };
}

export function writePrompts(rows, { file, perDomain }) {
  const picked = pickHumanTexts(rows, perDomain);
  const body = picked.map((h) => [idFor(h), h.domain, promptFor(h), ""].map(csvField).join(","));
  // The byte-order mark tells Excel the file is UTF-8 (otherwise "…" shows as "â€¦").
  writeFileSync(file, "\uFEFF" + ["id,genre,prompt,answer", ...body].join("\r\n") + "\r\n");
  return picked.length;
}

// Excel's plain "CSV" format saves in Windows-1252, not UTF-8. Such a file is decoded as Windows-1252,
// so curly quotes and dashes in the answers survive.
export function readAnyText(file) {
  const bytes = readFileSync(file);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

export function importAnswers(rows, { answers, out, perDomain }) {
  const byId = new Map(pickHumanTexts(rows, perDomain).map((h) => [idFor(h), h]));
  const [header, ...body] = parseCsv(readAnyText(answers).replace(/^\uFEFF/, ""));
  const cols = header.map((h) => h.trim().toLowerCase());
  const ii = cols.indexOf("id");
  // The filled-in prompts file (answer column) or a plain id,text file.
  const ti = cols.indexOf("answer") >= 0 ? cols.indexOf("answer") : cols.indexOf("text");
  if (ii < 0 || ti < 0) throw new Error('The answers file needs an "id" column and an "answer" (or "text") column.');
  const made = [];
  const problems = [];
  for (const r of body) {
    if (!(r[ti] || "").trim()) continue; // prompt not answered yet
    const human = byId.get((r[ii] || "").trim());
    if (!human) { problems.push(`unknown id ${r[ii]}`); continue; }
    const row = asRow(human, r[ti], "gemini-app");
    if (row) made.push(row); else problems.push(`id ${r[ii]}: answer too short or off-format`);
  }
  writeFileSync(out, [HEADER, ...made.map(toCsvLine)].join("\n") + "\n");
  return { saved: made.length, problems };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  const corpus = args[0];
  if (!corpus || corpus.startsWith("--")) {
    console.log("Usage: see the comments at the top of scripts/ai-text-gemini.js");
    process.exit(1);
  }
  const rows = loadWithGroups(readFileSync(corpus, "utf8"));

  if (args.includes("--prompts-out")) {
    const file = opt("--prompts-out");
    const n = writePrompts(rows, { file, perDomain: Number(opt("--per-domain", 10)) });
    console.log(`Saved ${n} prompts to ${file}. Paste each into Gemini and put the reply in the "answer" column.`);
    return;
  }
  if (args.includes("--import")) {
    const { saved, problems } = importAnswers(rows, { answers: opt("--import"), out: opt("--out", "gemini.csv"), perDomain: Number(opt("--per-domain", 10)) });
    console.log(`Saved ${saved} Gemini texts to ${opt("--out", "gemini.csv")}.`);
    for (const p of problems) console.log(`  Left out: ${p}`);
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.log("GEMINI_API_KEY is not set. Get a free key at aistudio.google.com, or use --prompts-out to work in the Gemini app.");
    process.exit(1);
  }
  await generateWithApi(rows, {
    out: opt("--out", "gemini.csv"),
    perDomain: Number(opt("--per-domain", 150)),
    model: opt("--model", "gemini-flash-latest"),
    gapMs: Number(opt("--gap", process.env.GEMINI_GAP_MS ?? 4500)),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
