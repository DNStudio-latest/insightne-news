// Thesis checker: reads a thesis chapter, finds the author's own prose, scores it with the academic model and
// suggests edits. No dependencies; runs in the browser (admin page, offline file) and in Node (tests, scripts).
// Nothing here sends text anywhere.
//
// The research behind each check is listed in docs/10-THESIS-AI-TOOLS.md.

import { scoreText, scoreSentences, splitSentences, tokenize, normKey, applyAlternative, PHRASE_ADVICE, SAFE_REPLACEMENTS } from "./engine.js";
import { EXCESS_WORDS } from "./academic-words.js";
import { VOICE_NORMS } from "./academic-norms.js";

export { applyAlternative, VOICE_NORMS, EXCESS_WORDS };

export const THESIS_DISCLAIMER =
  "A score is a statistical estimate, not proof of who wrote a text. Formal academic prose and writing by people " +
  "whose first language is not English are flagged in error more often. The suggestions improve your own writing; " +
  "they are not a way to hide AI use. Follow your university's rules and the UGC regulations, and disclose any AI " +
  "assistance as they require.";

// Paragraphs shorter than this (in the author's own words) are scored only as part of their section.
export const MIN_PARAGRAPH_WORDS = 60;
export const MIN_SECTION_WORDS = 150;

// ---------- reading .docx files (Word) ----------

const td = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open .docx files. Copy the text and paste it instead.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Returns { name: Uint8Array } for the wanted files of a ZIP archive (a .docx is a ZIP of XML files).
export async function unzip(buffer, wanted) {
  const b = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("This file is not a Word .docx file. Save it as .docx, or paste the text.");
  const count = u16(b, eocd + 10);
  let p = u32(b, eocd + 16);
  const out = {};
  for (let n = 0; n < count && u32(b, p) === 0x02014b50; n++) {
    const method = u16(b, p + 10);
    const size = u32(b, p + 20);
    const nameLen = u16(b, p + 28);
    const extraLen = u16(b, p + 30);
    const commentLen = u16(b, p + 32);
    const local = u32(b, p + 42);
    const name = td.decode(b.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!wanted.includes(name)) continue;
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28);
    const data = b.subarray(start, start + size);
    if (method === 0) out[name] = data;
    else if (method === 8) out[name] = await inflateRaw(data);
    else throw new Error("This .docx file uses a compression this tool cannot read. Paste the text instead.");
  }
  return out;
}

const decodeXml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

// Paragraphs of a Word document: [{ text, style, table, list }]. Deleted tracked changes are left out;
// footnotes, headers and text boxes are not read.
export function docxParagraphs(documentXml, stylesXml = "") {
  const names = {};
  for (const m of stylesXml.matchAll(/<w:style\b[^>]*w:styleId="([^"]+)"[^>]*>([\s\S]*?)<\/w:style>/g)) {
    const name = m[2].match(/<w:name w:val="([^"]+)"/);
    if (name) names[m[1]] = name[1];
  }
  const out = [];
  let tableDepth = 0;
  for (const m of documentXml.matchAll(/<w:tbl>|<w:tbl\s[^>]*>|<\/w:tbl>|<w:p\b[^>]*\/>|<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)) {
    const tag = m[0];
    if (/^<w:tbl[\s>]/.test(tag)) { tableDepth++; continue; }
    if (tag === "</w:tbl>") { tableDepth = Math.max(0, tableDepth - 1); continue; }
    if (tag.endsWith("/>") && !tag.includes("</w:p>")) { out.push({ text: "", style: "", table: tableDepth > 0, list: false }); continue; }
    const body = tag.replace(/<w:del\b[\s\S]*?<\/w:del>/g, "");
    const styleId = (body.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || "";
    const text = decodeXml(
      body
        .replace(/<w:tab\/>/g, "\t")
        .replace(/<w:(?:br|cr)\b[^>]*\/>/g, "\n")
        .replace(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<[^>]+>/g, (_, t) => t ?? "")
    ).replace(/[ \t\u00a0]+/g, " ").trim();
    out.push({ text, style: names[styleId] || styleId, table: tableDepth > 0, list: /<w:numPr>/.test(body) });
  }
  return out;
}

export async function readDocx(buffer) {
  const files = await unzip(buffer, ["word/document.xml", "word/styles.xml"]);
  if (!files["word/document.xml"]) throw new Error("No document text was found in this .docx file.");
  return docxParagraphs(td.decode(files["word/document.xml"]), files["word/styles.xml"] ? td.decode(files["word/styles.xml"]) : "");
}

// Pasted or .txt text: paragraphs are separated by blank lines (or by single line breaks when there are none).
export function paragraphsFromText(text) {
  const raw = String(text || "").replace(/\r\n?/g, "\n");
  const parts = /\n\s*\n/.test(raw) ? raw.split(/\n\s*\n/) : raw.split("\n");
  return parts.map((t) => ({ text: t.replace(/\s*\n\s*/g, " ").replace(/[ \t\u00a0]+/g, " ").trim(), style: "", table: false, list: false })).filter((p) => p.text);
}

// ---------- the author's own words ----------

// Citations in the common styles: (Author, 2019), (Author et al., 2019, p. 4; Other 2020), Author (2019),
// numbered [12], [3–5], and (n.d.).
const YEAR = "(?:1[5-9]\\d{2}|20\\d{2})[a-z]?|n\\.d\\.";
export const CITATION_RE = new RegExp(
  `\\((?:see |cf\\. |e\\.g\\., |i\\.e\\., )?[^()]{0,160}?\\b(?:${YEAR})(?:[^()]{0,60})?\\)` +
  `|(?<!\\p{L})\\p{Lu}[\\p{L}'’-]+(?:,? (?:and|&) \\p{Lu}[\\p{L}'’-]+| et al\\.)?['’]?s? \\((?:${YEAR})(?:, (?:p|pp)\\. ?\\d+(?:[–-]\\d+)?)?\\)` +
  `|\\[\\d+(?:\\s*[,–-]\\s*\\d+)*\\]`,
  "gu"
);

export function findCitations(text) {
  return [...String(text || "").matchAll(CITATION_RE)].map((m) => ({ text: m[0], index: m.index }));
}

// Direct quotations of four or more words, in double quotes or curly single quotes.
const QUOTE_RE = /“[^”]{1,2000}”|"[^"\n]{1,2000}"|‘[^’]{1,2000}’(?!\p{L})/gu;

export function findQuotes(text) {
  return [...String(text || "").matchAll(QUOTE_RE)]
    .filter((m) => tokenize(m[0]).length >= 4)
    .map((m) => ({ text: m[0], index: m.index }));
}

// Character ranges that are not the author's own words (quotations and citations): never scored or changed.
export function protectedRanges(text) {
  return [...findQuotes(text), ...findCitations(text)]
    .map((r) => [r.index, r.index + r.text.length])
    .sort((a, b) => a[0] - b[0]);
}

const inside = (ranges, at, end = at) => ranges.some(([a, b]) => at < b && end > a);

// The paragraph without quotations, citations, URLs and footnote numbers: the text that is scored.
export function authorText(text) {
  return String(text || "")
    .replace(QUOTE_RE, (q) => (tokenize(q).length >= 4 ? " " : q))
    .replace(CITATION_RE, " ")
    .replace(/https?:\/\/\S+|www\.\S+/g, " ")
    .replace(/(?<=[.,;:)\p{L}])\d{1,3}(?=\s|$)/gu, "") // footnote numbers stuck to words
    .replace(/\s+([.,;:)])/g, "$1")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- the parts of a thesis ----------

const REFERENCES_HEAD = /^(?:\d+(?:\.\d+)*\.?\s+)?(?:references?|bibliography|works cited|reference list|literature cited|select bibliography|sources(?: consulted)?|webliography)\s*:?$/i;
const RESUME_HEAD = /^(?:chapter|appendix|appendices|annexure|annex|glossary)\b/i;
const CAPTION = /^(?:table|figure|fig\.|chart|graph|plate|map|image|photo|exhibit)\s*[\dIVX]+(?:[.:\-–]\d+)?/i;
const INTERVIEW = /^(?:respondent|participant|interviewee|informant|journalist|editor|reporter|r|p)\s*[-#]?\s*\d*\s*(?:\([^)]{0,40}\))?\s*[:–—-]\s/i;
const REFERENCE_ENTRY = /^\p{Lu}[\p{L}'’-]+,\s(?:\p{Lu}\.\s?)+.{0,200}?\(?(?:1[5-9]\d{2}|20\d{2}|n\.d\.)[a-z]?\)?[.,]/u;

// Share of a paragraph's words that are inside quotation marks.
function quotedShare(text) {
  const all = tokenize(text).length;
  return all ? findQuotes(text).reduce((n, q) => n + tokenize(q.text).length, 0) / all : 0;
}

export function isHeading(p) {
  const t = p.text;
  const words = tokenize(t).length;
  if (/heading|title/i.test(p.style || "")) return true;
  if (/^(?:chapter|part|section)\s+(?:[\dIVXLC]+|one|two|three|four|five|six|seven|eight|nine|ten)\b/i.test(t) && words <= 16) return true;
  if (/^\d+(?:\.\d+){0,4}\.?\s+\p{Lu}/u.test(t) && words <= 14 && !/[.!?]$/.test(t)) return true;
  return words > 0 && words <= 10 && !/[.!?:;,]$/.test(t) && /^\p{Lu}/u.test(t) && !p.list;
}

// Labels every paragraph: heading, prose, quote, reference, caption, table or list. Returns
// [{ index, text, kind, section, own }] where `own` is the author's own text (prose only).
export function classifyParagraphs(paragraphs) {
  let section = "Start";
  let inReferences = false;
  return paragraphs.map((p, index) => {
    const text = String(p.text || "").trim();
    let kind = "prose";
    if (!text) kind = "empty";
    else if (p.table) kind = "table";
    else if (CAPTION.test(text) && !inReferences) kind = "caption";
    else if (isHeading({ ...p, text })) {
      kind = "heading";
      // The reference list runs from its heading to the next chapter or appendix; sub-headings inside it
      // ("Books", "Newspaper reports") stay part of it.
      if (REFERENCES_HEAD.test(text)) inReferences = true;
      else if (RESUME_HEAD.test(text) || /^\d+(?:\.\d+)*\.?\s/.test(text)) inReferences = false;
      section = text.slice(0, 120);
    } else if (inReferences || REFERENCE_ENTRY.test(text)) kind = "reference";
    else if (CAPTION.test(text)) kind = "caption";
    else if (/quote|quotation|block ?text/i.test(p.style || "") || INTERVIEW.test(text) || quotedShare(text) >= 0.6) kind = "quote";
    else if (p.list || /^(?:[•▪◦·*–-]|\(?[a-z0-9ivx]{1,4}[.)])\s/i.test(text)) kind = "list";
    const own = kind === "prose" || kind === "list" ? authorText(text) : "";
    return { index, text, kind, section, own };
  });
}

// ---------- the writer's voice (stance and metadiscourse) ----------
// After Hyland's (2005) model of metadiscourse. Corpus studies find that AI academic text uses fewer hedges,
// self-mentions and attitude markers, and more frame markers and transitions, than human writers (for example
// Jiang and Hyland 2024, Applied Linguistics; Mo et al. 2025, Journal of English for Academic Purposes).

const list = (s) => s.split("|");
export const VOICE_MARKERS = {
  hedges: list("may|might|could|perhaps|possibly|possible|probably|likely|unlikely|apparently|appear|appears|appeared|seem|seems|seemed|suggest|suggests|suggested|suggesting|indicate|indicates|tend to|tends to|tended to|largely|mainly|mostly|generally|usually|often|somewhat|relatively|approximately|roughly|arguably|presumably|to some extent|in part|partly|in most cases|it is possible that|would"),
  boosters: list("clearly|certainly|definitely|undoubtedly|undeniably|indisputably|obviously|evidently|surely|of course|indeed|always|never|prove|proves|proved|proven|demonstrate|demonstrates|demonstrated|it is clear that|it is evident that|without doubt|beyond doubt|there is no doubt|in fact|conclusively"),
  selfMention: list("i|me|my|mine|myself|we|us|our|ours|ourselves|the researcher|the present researcher|this researcher|the author|the present author|the investigator|the scholar"),
  attitude: list("interestingly|surprisingly|unfortunately|fortunately|remarkably|strikingly|curiously|admittedly|regrettably|unexpectedly|disappointingly|hopefully|understandably|ironically|importantly|significantly enough"),
  frameMarkers: list("firstly|secondly|thirdly|lastly|finally|in conclusion|to conclude|to sum up|in summary|to summarise|to summarize|overall|this study|this paper|this chapter|this thesis|this research|the present study|the current study|this section|aims to|aim to|the aim of|the purpose of|the objective of|seeks to|sets out to"),
  transitions: list("moreover|furthermore|additionally|in addition|likewise|similarly|besides|however|nevertheless|nonetheless|conversely|whereas|therefore|thus|hence|consequently|accordingly|as a result"),
};

export const VOICE_LABELS = {
  hedges: "Hedges (may, might, suggests, appears)",
  boosters: "Boosters (clearly, proves, undoubtedly)",
  selfMention: "Self-mention (I, we, the researcher)",
  attitude: "Attitude markers (surprisingly, unfortunately)",
  frameMarkers: "Frame markers (this study, firstly, in conclusion)",
  transitions: "Transitions (moreover, however, therefore)",
  citations: "Citations",
  excessWords: "Words that rose with ChatGPT (Kobak et al. 2025)",
};

const markerRes = Object.fromEntries(
  Object.entries(VOICE_MARKERS).map(([k, words]) => [
    k,
    new RegExp(`(?<!\\p{L})(?:${words.sort((a, b) => b.length - a.length).map((w) => w.replace(/ /g, "\\s+")).join("|")})(?!\\p{L})`, "giu"),
  ])
);

// Rates per 1,000 words of the author's own text, plus sentence rhythm. `full` is the paragraph with its
// citations (for the citation rate); `own` defaults to authorText(full).
export function voiceProfile(full, own = authorText(full)) {
  const words = tokenize(own).length;
  const per1000 = (n) => (words ? Math.round((n / words) * 10000) / 10 : 0);
  const rates = {};
  for (const [k, re] of Object.entries(markerRes)) {
    // "I" only as a word on its own and capitalised (not the Roman numeral in a list).
    rates[k] = per1000(k === "selfMention"
      ? [...own.matchAll(re)].filter((m) => m[0] !== "i").length
      : (own.match(re) || []).length);
  }
  rates.citations = per1000(findCitations(full).length);
  rates.excessWords = per1000(tokenize(own).filter((w) => EXCESS_WORDS[w.toLowerCase()]).length);
  const lengths = splitSentences(own).map((s) => tokenize(s).length).filter((n) => n > 0);
  const m = lengths.reduce((a, b) => a + b, 0) / (lengths.length || 1);
  const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - m) ** 2, 0) / (lengths.length || 1));
  return { words, sentences: lengths.length, rates, meanSentence: Math.round(m * 10) / 10, sentenceVariation: m ? Math.round((sd / m) * 100) / 100 : 0 };
}

// Typical values (VOICE_NORMS) come from the training corpus: see scripts/thesis-norms.js.

// ---------- suggestions ----------

// Plainer words for the rising style words that PHRASE_ADVICE does not cover. Each keeps the meaning in most
// academic sentences; the author chooses.
export const ACADEMIC_ALTERNATIVES = {
  delved: ["examined", "studied"], delving: ["examining", "studying"],
  underscored: ["showed", "stressed"], showcased: ["showed", "presented"],
  intricately: ["closely", "in detail"], surpassing: ["exceeding", "beyond"], surpasses: ["exceeds"], surpassed: ["exceeded"], surpass: ["exceed"],
  excels: ["does well", "is strong"], garnering: ["gaining", "attracting"],
  comprehending: ["understanding"], comprehend: ["understand"],
  encompassed: ["included", "covered"], encompassing: ["including", "covering"], encompasses: ["includes", "covers"], encompass: ["include", "cover"],
  emphasizing: ["stressing"], emphasising: ["stressing"], emphasizes: ["stresses"], emphasises: ["stresses"],
  realms: ["fields", "areas"], renowned: ["well-known", "known"], grappling: ["dealing", "struggling"],
  necessitating: ["requiring"], necessitates: ["requires"], necessitate: ["require"],
  bolstering: ["strengthening", "supporting"], bolster: ["strengthen", "support"], bolstered: ["strengthened", "supported"],
  revolutionizing: ["changing", "transforming"], revolutionize: ["change", "transform"],
  advancements: ["advances", "developments"], advancement: ["advance", "progress"],
  endeavors: ["efforts"], endeavours: ["efforts"], aligning: ["matching", "bringing into line"], aligns: ["fits", "matches"],
  formidable: ["serious", "difficult"], aiding: ["helping"], consolidates: ["strengthens", "combines"],
  dependable: ["reliable"], dependability: ["reliability"], unveils: ["shows", "reveals"], unveiled: ["showed", "revealed"], unveiling: ["revealing"], unveil: ["reveal", "show"],
  discernible: ["visible", "clear"], discern: ["see", "identify"], discerned: ["identified", "saw"], discerning: ["careful", "perceptive"],
  notable: ["important", "marked"], expediting: ["speeding up"], expedite: ["speed up"], heightened: ["increased", "greater"],
  overlooking: ["ignoring", "missing"], overlook: ["ignore", "miss"], escalating: ["rising", "growing"],
  underexplored: ["little studied"], uncharted: ["unstudied", "new"], unexplored: ["unstudied"],
  pinpointed: ["identified"], pinpointing: ["identifying"], pinpoint: ["identify"],
  pioneers: ["leads", "first develops"], pioneering: ["early", "first"],
  scrutinizing: ["examining"], scrutinize: ["examine"], advocating: ["arguing for", "supporting"],
  elucidates: ["explains"], elucidating: ["explaining"], elucidate: ["explain"],
  crafting: ["making", "writing"], crafted: ["made", "written"], emerges: ["appears", "arises"],
  adept: ["skilled"], exceptional: ["unusual", "outstanding"], posing: ["raising", "presenting"], poses: ["raises", "presents"],
  harnesses: ["uses"], groundwork: ["basis", "foundation"], accentuates: ["stresses", "sharpens"],
  swift: ["quick", "fast"], swiftly: ["quickly"], refining: ["improving"], refines: ["improves"], refine: ["improve"],
  urging: ["calling for", "asking"], highlighting: ["showing", "noting"], highlights: ["shows", "notes"],
  encapsulates: ["sums up", "captures"], enhancements: ["improvements"], paving: ["preparing", "opening"],
  unraveling: ["explaining", "untangling"], interconnectedness: ["links", "connections"],
  upholding: ["keeping", "maintaining"], uphold: ["keep", "maintain"], delineates: ["describes", "sets out"],
  inquiries: ["questions", "studies"], fosters: ["encourages", "builds"], categorizes: ["groups", "classifies"],
  streamlining: ["simplifying"], hinges: ["depends"], gauged: ["measured", "assessed"],
  exacerbating: ["worsening"], affirming: ["confirming"], utilizing: ["using"], utilizes: ["uses"], utilized: ["used"],
  avenues: ["ways", "routes"], avenue: ["way", "route"], illuminates: ["explains", "shows"], illuminating: ["revealing", "explaining"],
  culminating: ["ending"], propelling: ["driving", "pushing"], revolves: ["centres", "turns"],
  akin: ["similar", "like"], insights: ["findings", "understanding"], impacting: ["affecting"], impactful: ["effective", "influential"],
  facilitating: ["helping", "enabling"], employing: ["using"], employs: ["uses"], employed: ["used"],
  burgeoning: ["growing"], exhibiting: ["showing"], exhibits: ["shows"], exhibited: ["showed"], exhibit: ["show"],
  integrates: ["combines"], orchestrating: ["organising", "directing"], ensuring: ["making sure"],
  foundational: ["basic", "founding"], impeding: ["hindering", "slowing"], impede: ["hinder", "slow"],
  valuable: ["useful"], optimizing: ["improving"], poised: ["ready", "set"], unlocking: ["opening", "enabling"],
  surmount: ["overcome"], capabilities: ["abilities", "capacity"], inadequately: ["poorly"], offers: ["gives", "provides"],
  juxtaposed: ["contrasted", "set beside"], warranting: ["justifying", "needing"], investigates: ["examines", "studies"],
  innovative: ["new", "original"], spanning: ["covering"], augmenting: ["adding to", "increasing"],
  interplay: ["interaction", "relationship"], adhering: ["keeping", "following"], detrimentally: ["harmfully", "badly"],
  solidify: ["strengthen", "confirm"], necessity: ["need"], enduring: ["lasting"], conversely: ["", "on the other hand,"],
  incorporating: ["including"], substantiated: ["supported", "confirmed"], substantiates: ["supports", "confirms"],
  capitalizing: ["building on", "using"], combating: ["fighting", "tackling"], imperative: ["essential", "necessary"],
  shedding: ["casting", "giving"], strategically: ["deliberately"], pressing: ["urgent"], elevates: ["raises"],
  equipping: ["giving", "preparing"], signifying: ["meaning", "showing"], heighten: ["increase", "raise"],
  achieving: ["reaching", "gaining"], emulating: ["copying", "imitating"], nuances: ["details", "subtleties"],
  stemming: ["arising", "coming"], spurred: ["prompted", "encouraged"], serves: ["is", "acts as"],
  diminishes: ["reduces"], spanned: ["covered"], enabling: ["allowing", "letting"], advocates: ["supports", "argues for"],
  compelling: ["convincing", "strong"], merges: ["combines"], acknowledges: ["accepts", "recognises"], acknowledging: ["accepting", "recognising"],
  addresses: ["deals with", "tackles"], addressing: ["dealing with", "tackling"], exploring: ["examining", "studying"], explores: ["examines", "studies"],
  introduces: ["presents", "sets out"], customizing: ["adapting"], surged: ["rose sharply"], promise: ["potential"],
};

function alternativesFor(word) {
  const k = normKey(word);
  return PHRASE_ADVICE[k] || ACADEMIC_ALTERNATIVES[k] || null;
}

const p = (re, message, kind = "pattern") => ({ re, message, kind });

// Formulas common in AI academic prose, each with what to do instead. Matches inside quotations or citations
// are skipped.
export const ACADEMIC_PATTERNS = [
  p(/\b(?:this|the present|the current) (?:study|paper|chapter|thesis|research|section|article) (?:aims|seeks|attempts|endeavou?rs|sets out|strives) to (?:explore|examine|investigate|delve|shed light|provide|offer|understand|analy[sz]e)\b/gi,
    'A stock opening ("This study aims to explore…"). Say what the chapter does or finds, in your own terms: "This chapter compares how three Agartala dailies covered…".'),
  p(/\bplays? (?:a|an) (?:crucial|pivotal|vital|significant|key|important|critical|central|instrumental|major) role\b/gi,
    '"Plays a crucial role" is one of the most frequent formulas in AI academic text. Say what it actually does: "shapes", "decides", "limits".'),
  p(/(?:^|[.!?]\s+)In (?:today's|the contemporary|the modern|the current|an era of|this era of|the digital|an increasingly|recent years|the age of)\b[^.!?,]{0,60},/gi,
    'A sweeping scene-setting opener ("In today\'s digital age, …"). Start with your subject or your claim; give a date or a source if the timing matters.'),
  p(/\b(?:a|an) (?:nuanced|comprehensive|holistic|deeper|thorough|richer|more nuanced|more comprehensive) understanding of\b/gi,
    '"A nuanced/comprehensive understanding of" is formulaic. Name what the reader will understand, or cut it.'),
  p(/\b(?:offers?|provides?|yields?|gives?|provided|offered) (?:valuable|important|significant|key|crucial|rich|deep|fresh|new) insights?\b/gi,
    '"Provides valuable insights" is vague and common in AI text. State the finding itself.'),
  p(/\b(?:highlights?|underscores?|emphasi[sz]es?|stresses|reinforces?|demonstrates?) the (?:importance|need|significance|necessity|value|relevance|urgency) of\b/gi,
    '"Highlights the importance of" tells the reader that something matters without saying why. Give the reason or the consequence.'),
  p(/\b(?:the )?(?:intricate|complex|dynamic|delicate|multifaceted) (?:interplay|relationship|interaction|dynamics|web|tapestry) (?:between|of|among)\b/gi,
    '"The intricate interplay between…" is a frequent AI formula. Name the actual relationship (who influences whom, and how).'),
  p(/\bserves? as (?:a|an) (?:testament|reminder|catalyst|cornerstone|beacon|foundation|bridge|lens|springboard)\b/gi,
    'A stock metaphor ("serves as a testament/catalyst/cornerstone"). Use a plain verb and the evidence.'),
  p(/\bnavigat(?:e|es|ing|ed) (?:the )?(?:complexities|complex|challenges|landscape|intricacies|terrain|nuances)\b/gi,
    '"Navigating the complexities" is a stock metaphor. Say what the people or institutions actually did.'),
  p(/,\s+(?:highlighting|underscoring|emphasi[sz]ing|reflecting|signalling|signaling|illustrating|showcasing|demonstrating|revealing|indicating|suggesting|thereby|ultimately) [^.!?;]{3,140}/gi,
    'A trailing "-ing" clause after a comma (", highlighting…", ", reflecting…") adds an interpretation without evidence and is a hallmark of AI prose. Make it its own sentence and support it with a source or your data.'),
  p(/\bnot only\b[^.!?]{1,140}?\bbut also\b/gi,
    '"Not only … but also" is a common AI pattern. Two plain clauses joined by "and", or two sentences, often read better.'),
  p(/\b(?:it is|it's) not (?:just|only|merely|simply) (?:about )?[^.!?]{1,80}?[,;—–-]\s*(?:it is|it's|but)\b/gi,
    '"It is not just X, it is Y" is a stock contrast in AI prose. State the point directly.'),
  p(/\b(?:ranging|spanning) from [^.!?]{2,60}? to [^.!?]{2,60}?(?:,|\band\b)/gi,
    '"Ranging from X to Y" lists are common in AI text. If the range matters, give the actual items or figures.'),
  p(/(?:^|[.!?]\s+)(?:In conclusion|To conclude|In summary|To sum up|Overall|Ultimately|In essence|All in all),/g,
    'A summing-up opener. In a thesis, conclusions belong in the conclusion section; elsewhere end the paragraph on your last point of evidence.'),
  p(/\b(?:paves?|paving|paved) the way\b|\blays? the (?:groundwork|foundation)\b|\bopens? (?:up )?new avenues\b|\bshed(?:s|ding)? (?:new )?light on\b/gi,
    'A stock metaphor for contribution. Say exactly what becomes possible or clearer, and for whom.'),
  p(/\b(?:in|within) the (?:realm|landscape|sphere|domain|tapestry|fabric) of\b/gi,
    '"In the realm/landscape of" is padding. Use "in" or name the field.'),
  p(/\b(?:a|an) (?:wide|diverse|broad|rich|vast) (?:array|range|spectrum|variety|tapestry|plethora) of\b/gi,
    '"A wide array of" is vague. Give the number or name the items.'),
];

// Claims about the literature that normally need a citation in the same sentence.
const NEEDS_SOURCE = /\b(?:(?:many|several|numerous|various|some|most|recent|previous|prior|existing) (?:studies|scholars|researchers|authors|works|experts|critics|observers)|studies (?:have )?(?:show|shown|found|suggest|indicate)|research (?:has )?(?:show|shown|found|suggest|indicate)|(?:it is|it has been) (?:widely|generally|commonly|often) (?:argued|accepted|believed|acknowledged|recognised|recognized|noted|held)|scholars (?:have )?(?:argued|noted|shown|found|observed)|the (?:existing|extant|current) literature|according to (?:experts|scholars|researchers|studies))\b/i;

// Boosters that overclaim in social-science writing.
const OVERCLAIM = /\b(?:proves?|proved|proven|undeniably|undoubtedly|indisputably|unquestionably|without (?:a )?doubt|beyond (?:any )?doubt|it is (?:clear|evident|obvious) that|clearly (?:shows?|demonstrates?)|definitively)\b/gi;

function excerpt(text, index, length) {
  const start = Math.max(0, index - 50);
  const end = Math.min(text.length, index + length + 50);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ") + (end < text.length ? "…" : "");
}

const WORDY_RE = new RegExp(`(?<!\\p{L})(?:${Object.keys(SAFE_REPLACEMENTS).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+").replace(/'/g, "['’]")).join("|")})(?!\\p{L})`, "giu");

// Suggestions for one paragraph. Indexes refer to `text`, so the page can apply an alternative in place with
// applyAlternative(). Quotations and citations are never flagged. Pass the academic model to also mark the
// sentences it reads as AI-written.
export function academicSuggestions(text, { model } = {}) {
  const raw = String(text || "");
  const guard = protectedRanges(raw);
  const out = [];
  const add = (s) => { if (!inside(guard, s.index, s.index + (s.length || 0))) out.push(s); };

  for (const m of raw.matchAll(WORDY_RE)) {
    const to = SAFE_REPLACEMENTS[normKey(m[0])];
    add({ kind: "wordy", index: m.index, length: m[0].length, phrase: m[0], alternatives: [to], excerpt: excerpt(raw, m.index, m[0].length), message: `"${m[0]}" can be shorter: "${to}".` });
  }

  for (const m of raw.matchAll(/\p{L}+(?:-\p{L}+)?/gu)) {
    const ratio = EXCESS_WORDS[m[0].toLowerCase()];
    if (!ratio) continue;
    // Already covered by a wordy-phrase flag with a fixed replacement ("delves into" -> "examines").
    if (out.some((x) => x.kind === "wordy" && m.index >= x.index && m.index < x.index + x.length)) continue;
    const alternatives = alternativesFor(m[0]);
    add({
      kind: "excess",
      index: m.index,
      length: m[0].length,
      phrase: m[0],
      ratio,
      alternatives: alternatives || [],
      excerpt: excerpt(raw, m.index, m[0].length),
      message: `"${m[0]}" appeared in ${ratio} times as many research abstracts in 2024 as in 2022, a rise linked to ChatGPT (Kobak et al. 2025). Keep it only if it is the exact word you need.`,
    });
  }

  for (const pat of ACADEMIC_PATTERNS) {
    for (const m of raw.matchAll(pat.re)) {
      const lead = Math.max(0, m[0].search(/\p{L}/u));
      const index = m.index + lead;
      add({ kind: pat.kind, index, length: m[0].length - lead, excerpt: excerpt(raw, index, Math.min(80, m[0].length)), message: pat.message });
    }
  }

  let from = 0;
  for (const s of splitSentences(raw)) {
    const index = raw.indexOf(s, from);
    if (index < 0) continue;
    from = index + s.length;
    if (tokenize(authorText(s)).length < 4) continue; // a quotation or a citation, not the author's sentence
    if (NEEDS_SOURCE.test(s) && !findCitations(s).length) {
      add({ kind: "source", index, length: s.length, excerpt: s, message: "This sentence makes a claim about the literature but has no citation. Add the studies you mean, or narrow the claim." });
    }
    for (const m of s.matchAll(OVERCLAIM)) {
      add({ kind: "overclaim", index: index + m.index, length: m[0].length, phrase: m[0], excerpt: excerpt(raw, index + m.index, m[0].length), message: `"${m[0]}" overstates what most social-science evidence can show. Consider "suggests", "indicates" or "is consistent with", unless the evidence really is conclusive.` });
    }
    const n = tokenize(s).length;
    if (n > 45) add({ kind: "long", index, length: s.length, excerpt: excerpt(raw, index, 90), message: `This sentence has ${n} words. Consider splitting it.` });
  }

  if (model) {
    for (const s of scoreSentences(raw, model)) {
      if (!s.aiLike || inside(guard, s.index, s.index + s.sentence.length)) continue;
      add({ kind: "sentence", index: s.index, length: s.sentence.length, excerpt: s.sentence, cues: s.cues, message: `The model reads this sentence as AI-like${s.cues.length ? ` (it weighs ${s.cues.map((c) => `"${c}"`).join(", ")})` : ""}. Rewrite it in your own words: add your evidence, a specific case, a source or your own judgement.` });
    }
  }

  // Rhythm: very even sentence lengths across the paragraph.
  const lengths = splitSentences(authorText(raw)).map((s) => tokenize(s).length);
  if (lengths.length >= 5) {
    const m = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - m) ** 2, 0) / lengths.length);
    if (m && sd / m < 0.25) out.push({ kind: "uniform", message: "The sentences in this paragraph are all about the same length. Vary them where the argument allows." });
  }

  // Overlapping flags: keep the more specific one (patterns and words inside a flagged sentence stay).
  return out.sort((a, b) => (a.index ?? 1e9) - (b.index ?? 1e9));
}

// ---------- the whole document ----------

function band(score, model) {
  const th = model?.thresholds || { low: 0.3, high: 0.7 };
  return score >= th.high * 100 ? "ai" : score <= th.low * 100 ? "human" : "mixed";
}

// Analyses a list of paragraphs (from readDocx or paragraphsFromText). Returns
// { paragraphs, sections, summary, voice }. `model` is the academic model (ACADEMIC_MODEL).
export function analyseThesis(paragraphs, model, { suggestions = true } = {}) {
  const parts = classifyParagraphs(paragraphs);
  const sections = [];
  let current = null;
  for (const part of parts) {
    if (!current || (part.kind === "heading" && part.section !== current.title)) {
      current = { title: part.kind === "heading" ? part.section : "Start", own: [], full: [], paragraphs: [] };
      sections.push(current);
    }
    if (part.own) { current.own.push(part.own); current.full.push(part.text); }
    current.paragraphs.push(part);
  }

  let scoredWords = 0;
  const totals = { ai: 0, mixed: 0, human: 0, short: 0 };
  for (const part of parts) {
    if (!part.own) continue;
    const words = tokenize(part.own).length;
    part.words = words;
    if (words >= MIN_PARAGRAPH_WORDS && model) {
      const r = scoreText(part.own, model);
      part.score = r.score;
      part.band = band(r.score, model);
      part.cues = r.phrases.ai;
      totals[part.band] += words;
      scoredWords += words;
    } else {
      totals.short += words;
    }
    if (suggestions) part.suggestions = academicSuggestions(part.text, { model });
  }

  const sectionOut = sections
    .map((s) => {
      const own = s.own.join("\n\n");
      const words = tokenize(own).length;
      const out = { title: s.title, words, paragraphs: s.paragraphs.map((p) => p.index) };
      if (model && words >= MIN_SECTION_WORDS) {
        const r = scoreText(own, model);
        out.score = r.score;
        out.band = band(r.score, model);
        out.cues = r.phrases.ai;
      }
      return out;
    })
    .filter((s) => s.words > 0);

  const ownAll = parts.filter((p) => p.own).map((p) => p.own).join("\n\n");
  const fullAll = parts.filter((p) => p.own).map((p) => p.text).join("\n\n");
  const counts = parts.reduce((m, p) => ({ ...m, [p.kind]: (m[p.kind] || 0) + 1 }), {});
  const share = (k) => (scoredWords ? Math.round((totals[k] / scoredWords) * 100) : 0);
  return {
    paragraphs: parts,
    sections: sectionOut,
    summary: {
      words: tokenize(ownAll).length,
      scoredWords,
      shares: { ai: share("ai"), mixed: share("mixed"), human: share("human") },
      shortWords: totals.short,
      counts,
      overall: model && tokenize(ownAll).length >= MIN_SECTION_WORDS ? scoreText(ownAll, model).score : null,
      threshold: model?.thresholds?.high ?? 0.7,
    },
    voice: voiceProfile(fullAll, ownAll),
  };
}
