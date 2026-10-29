// The text inside a PDF. Normal PDFs are read with "pdftotext". Scanned PDFs (photos of paper), and PDFs
// typed in old Bengali fonts that come out as nonsense, are read by OCR: "tesseract" in English + Bengali.
// Both tools are free and are installed automatically on GitHub (see .github/workflows/hunt.yml).
// If OCR is not installed (for example on your own computer), Gemini reads the scanned pages instead.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const run = promisify(execFile);
const MAX_PAGES = 12;
const OCR_PAGES = 6;

export const fingerprint = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

// How readable extracted text is, from 0 to 1. Old Bengali fonts give letters like "ÒÎ¸ê¦ý" instead of words.
export function readability(text) {
  const s = String(text || "");
  const letters = (s.match(/\p{L}/gu) || []).length;
  if (letters < 40) return 0;
  const bengali = (s.match(/[ঀ-৿]/g) || []).length;
  const english = (s.match(/\b[a-z]{2,}\b/gi) || []).filter((w) => /[aeiouy]/i.test(w)).join("").length;
  const junk = (s.match(/[À-ÿĀ-ɏ¦¤§¨©ª«¬®¯°±´µ¶·¸¹º»¼½¾¿]/g) || []).length;
  return Math.max(0, Math.min(1, (bengali + english - 3 * junk) / letters));
}

async function tool(name, args, options = {}) {
  try {
    const { stdout } = await run(name, args, { maxBuffer: 50 * 1024 * 1024, timeout: 180000, ...options });
    return stdout;
  } catch (err) {
    if (err.code === "ENOENT") return null; // the tool is not installed here
    throw err;
  }
}

async function ocr(file, dir) {
  const prefix = path.join(dir, "page");
  if ((await tool("pdftoppm", ["-r", "200", "-l", String(OCR_PAGES), "-png", file, prefix])) === null) return null;
  const pages = (await fs.readdir(dir)).filter((f) => f.startsWith("page") && f.endsWith(".png")).sort();
  const texts = [];
  for (const page of pages) {
    const out = await tool("tesseract", [path.join(dir, page), "-", "-l", "eng+ben", "--psm", "3"]);
    if (out === null) return null;
    texts.push(out);
  }
  return texts.join("\n\n");
}

// Gemini reads the PDF itself (used only when OCR is not installed). Returns null if it can't.
async function readWithGemini(bytes, generate) {
  if (!generate || bytes.length > 15 * 1024 * 1024) return null;
  const system = 'You copy the text of documents exactly. Reply with JSON: {"text": "..."}. Copy every word as written, in its own language and script (English, Bengali, Kokborok or other). Do not translate, summarize, correct or add anything. Write [unclear] where you cannot read a word.';
  const reply = await generate(system, [{ inlineData: { mimeType: "application/pdf", data: bytes.toString("base64") } }, { text: "Copy the text of this document." }]);
  return JSON.parse(reply.replace(/^\s*```(?:json)?|```\s*$/g, "")).text || null;
}

// Returns { text, method } where method is "text", "ocr" or "gemini", or { text: "", method: "unreadable" }.
export async function pdfToText(bytes, { generate, log = console.log } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hunter-"));
  const file = path.join(dir, "doc.pdf");
  try {
    await fs.writeFile(file, bytes);
    const plain = await tool("pdftotext", ["-layout", "-enc", "UTF-8", "-l", String(MAX_PAGES), file, "-"]).catch(() => "");
    if (plain && readability(plain) >= 0.6) return { text: plain.trim(), method: "text" };
    const scanned = await ocr(file, dir).catch((err) => (log(`  ✗ OCR failed: ${err.message}`), null));
    if (scanned && readability(scanned) >= 0.4) return { text: scanned.trim(), method: "ocr" };
    const read = await readWithGemini(bytes, generate).catch((err) => (log(`  ✗ Gemini could not read the PDF: ${err.message}`), null));
    if (read && readability(read) >= 0.4) return { text: read.trim(), method: "gemini" };
    return { text: (scanned || plain || "").trim(), method: "unreadable" };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}
