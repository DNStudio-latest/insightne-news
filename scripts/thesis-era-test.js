// Before/after-2022 test of the thesis checker on real theses and papers.
//
//   node scripts/thesis-era-test.js manifest.csv [--out report.json] [--min-words 60]
//
// manifest.csv has a header row "path,year,group" (group is a free label such as "thesis-pre2022"). Each path is a
// .pdf (read with pdftotext, which must be installed), .docx or .txt file. For every document the script rebuilds
// the paragraphs, keeps the author's own prose (thesis rules in public/ai-tools/academic.js) and reports, per
// group and per document:
//   - the share of paragraphs (60+ own words) that each checker marks as AI-like: the academic model at its
//     "AI-like" level and the website's news model at 70/100;
//   - commas per 100 words, sentence length and its variation, rough mistakes per 1,000 words and the words that
//     rose with ChatGPT (Kobak et al. 2025) per 1,000 words.
// Texts written before ChatGPT (November 2022) are known human writing: any paragraph flagged there is a false
// alarm. Texts written later are not labelled AI; they show how writing in the field changed.

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readDocx, paragraphsFromText, classifyParagraphs, voiceProfile } from "../public/ai-tools/academic.js";
import { scoreText, extractFeatures, tokenize } from "../public/ai-tools/engine.js";
import { ACADEMIC_MODEL } from "../public/ai-tools/model-academic.js";
import { TRAINED_MODEL } from "../public/ai-tools/model.js";
import { parseCsv } from "./ai-text-train.js";

// Rebuilds paragraphs from PDF text with hard line breaks: a paragraph ends at a blank line, or at a line that ends
// a sentence and is clearly shorter than a full line. Page numbers are dropped and words split at line ends joined.
export function pdfParagraphs(text) {
  const lines = String(text).replace(/\f/g, "\n\n").split("\n").map((l) => l.replace(/\s+$/, ""));
  const lengths = lines.map((l) => l.trim().length).filter((n) => n > 20).sort((a, b) => a - b);
  const full = lengths[Math.floor(lengths.length * 0.8)] || 80;
  const out = [];
  let cur = "";
  const flush = () => { if (cur.trim()) out.push(cur.trim()); cur = ""; };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^(?:page\s*)?[\divxlc]{1,4}$/i.test(line)) continue; // page number
    const heading = line.length < full * 0.6 && !/[.,;:!?”"’)]$/.test(line) && /^\p{Lu}|^\d/u.test(line);
    if (heading) { flush(); out.push(line); continue; }
    cur = cur ? (cur.endsWith("-") && /^\p{Ll}/u.test(line) ? cur.slice(0, -1) + line : `${cur} ${line}`) : line;
    if (/[.!?:”"’)]$/.test(line) && line.length < full * 0.85) flush();
  }
  flush();
  return out.map((t) => ({ text: t, style: "", table: false, list: false }));
}

// A rough count of everyday slips per 1,000 words (a proxy, not a grammar check).
export function mistakeRate(text) {
  const words = tokenize(text).length || 1;
  const n =
    (text.match(/[.!?]\s+\p{Ll}/gu) || []).length +                          // sentence starting in lower case
    (text.match(/\p{Ll}[,;:][\p{L}]{2,}/gu) || []).length +                   // no space after a comma
    (text.match(/\b(\w{2,})\s+\1\b/gi) || []).length +                        // doubled word
    (text.match(/\s[,;:](?=\s)/g) || []).length +                             // space before punctuation
    (text.match(/\ba\s+(?!uni|use|usu|one|eu|once|u\b)[aeiou]\w*/gi) || []).length +
    (text.match(/\ban\s+(?!h(?:our|onest|onou?r|eir))[bcdfgjklmnpqrstvwxyz]\w*/gi) || []).length +
    (text.match(/\b(?:informations|researches|evidences|equipments|knowledges|feedbacks|advices|literatures)\b/gi) || []).length +
    (text.match(/\b(?:this|that)\s+(?:studies|findings|results|factors|issues|newspapers)\b|\b(?:these|those)\s+(?:study|finding|result|factor|issue|newspaper)\b/gi) || []).length;
  return (n / words) * 1000;
}

async function readDocument(path) {
  if (/\.pdf$/i.test(path)) return pdfParagraphs(execFileSync("pdftotext", [path, "-"], { encoding: "utf8", maxBuffer: 64 << 20 }));
  if (/\.docx$/i.test(path)) return readDocx(readFileSync(path).buffer);
  return paragraphsFromText(readFileSync(path, "utf8"));
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const r = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

// Measures for a list of paragraphs (the author's own text).
export function measure(paragraphs, { minWords = 60 } = {}) {
  const scored = paragraphs.filter((p) => tokenize(p).length >= minWords);
  const academicTh = (ACADEMIC_MODEL.thresholds?.high ?? 0.7) * 100;
  const academic = scored.map((p) => scoreText(p, ACADEMIC_MODEL).score);
  const news = scored.map((p) => scoreText(p, TRAINED_MODEL).score);
  const f = scored.map((p) => extractFeatures(p).values);
  return {
    paragraphs: scored.length,
    words: scored.reduce((n, p) => n + tokenize(p).length, 0),
    academicFlagged: r(100 * mean(academic.map((s) => +(s >= academicTh)))),
    academicMean: r(mean(academic)),
    newsFlagged: r(100 * mean(news.map((s) => +(s >= 70)))),
    commasPer100: r(mean(f.map((v) => v.commaRate))),
    sentenceLength: r(mean(f.map((v) => v.meanSentenceLength))),
    sentenceVariation: r(mean(f.map((v) => (v.meanSentenceLength ? v.sentenceLengthSD / v.meanSentenceLength : 0))), 2),
    mistakesPer1000: r(mean(scored.map(mistakeRate))),
    chatgptWordsPer1000: r(mean(scored.map((p) => voiceProfile(p, p).rates.excessWords))),
    flaggedExamples: scored.map((p, i) => [academic[i], p]).filter(([s]) => s >= academicTh).slice(0, 3).map(([s, p]) => ({ score: s, text: p.slice(0, 400) })),
  };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (flag, fallback) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : fallback);
  const file = args[0];
  if (!file) {
    console.log("Usage: node scripts/thesis-era-test.js manifest.csv [--out report.json] [--min-words 60]");
    process.exit(1);
  }
  const minWords = Number(opt("--min-words", 60));
  const [head, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^﻿/, ""));
  const col = (n) => head.map((h) => h.trim().toLowerCase()).indexOf(n);
  const docs = [];
  for (const row of rows) {
    const path = row[col("path")];
    const parts = classifyParagraphs(await readDocument(path));
    const own = parts.filter((p) => p.kind === "prose" && p.own).map((p) => p.own);
    docs.push({ path, year: Number(row[col("year")]), group: row[col("group")], own });
  }
  const report = { createdAt: new Date().toISOString(), academicThreshold: ACADEMIC_MODEL.thresholds?.high, groups: {}, documents: [] };
  for (const group of [...new Set(docs.map((d) => d.group))]) {
    const ds = docs.filter((d) => d.group === group);
    report.groups[group] = { documents: ds.length, ...measure(ds.flatMap((d) => d.own), { minWords }) };
  }
  for (const d of docs) report.documents.push({ path: d.path, year: d.year, group: d.group, ...measure(d.own, { minWords }) });

  const cols = ["documents", "paragraphs", "words", "academicFlagged", "newsFlagged", "commasPer100", "sentenceLength", "sentenceVariation", "mistakesPer1000", "chatgptWordsPer1000"];
  console.table(Object.fromEntries(Object.entries(report.groups).map(([g, m]) => [g, Object.fromEntries(cols.map((c) => [c, m[c]]))])));
  console.table(report.documents.map((d) => ({ doc: d.path.split("/").slice(-2).join("/").slice(0, 60), year: d.year, group: d.group, paras: d.paragraphs, academic: d.academicFlagged, news: d.newsFlagged, commas: d.commasPer100, variation: d.sentenceVariation, mistakes: d.mistakesPer1000, gptWords: d.chatgptWordsPer1000 })));
  writeFileSync(opt("--out", "thesis-era-report.json"), JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
