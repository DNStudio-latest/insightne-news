// AI-text detector and style editor: one file, no dependencies.
// Runs in the browser (index.html) and in Node (tests and scripts/ai-text-train.js).
//
// A score is a statistical estimate from writing-style features. It is not proof that a
// person or a machine wrote a text. Use it as one signal among others.

export const FEATURES = [
  "meanSentenceLength",
  "sentenceLengthSD",
  "meanWordLength",
  "longWordShare",
  "windowedTTR",
  "commaRate",
  "semicolonColonRate",
  "dashRate",
  "exclaimRate",
  "contractionRate",
  "firstPersonRate",
  "transitionRate",
  "aiPhraseRate",
  "starterRepetition",
];

export const FEATURE_LABELS = {
  meanSentenceLength: "Average sentence length (words)",
  sentenceLengthSD: "Variation in sentence length",
  meanWordLength: "Average word length (letters)",
  longWordShare: "Share of long words (9+ letters)",
  windowedTTR: "Vocabulary variety",
  commaRate: "Commas per 100 words",
  semicolonColonRate: "Semicolons and colons per 100 words",
  dashRate: "Dashes per 100 words",
  exclaimRate: "Exclamation marks per 100 words",
  contractionRate: "Contractions per 100 words",
  firstPersonRate: "First-person words per 100 words",
  transitionRate: "Transition words per 100 words",
  aiPhraseRate: "Stock AI-style phrases per 1,000 words",
  starterRepetition: "Share of sentences opening with the same word",
};

// Built-in model. The weights are hand-set starting values and the means/sds are rough
// placeholders. Neither was estimated from labelled data, so the score is only a rough
// indicator until you train a model on your own corpus (scripts/ai-text-train.js).
export const DEFAULT_MODEL = {
  kind: "uncalibrated-prior",
  name: "Built-in default (uncalibrated)",
  features: FEATURES,
  means: [18, 8, 4.8, 0.12, 0.65, 4, 0.3, 0.3, 0.2, 0.8, 0.8, 1.0, 2, 0.2],
  sds: [6, 4, 0.5, 0.05, 0.08, 2, 0.3, 0.3, 0.3, 0.8, 0.8, 0.8, 2, 0.15],
  weights: [0.2, -0.6, 0.2, 0.2, 0, 0, 0.1, 0.5, -0.3, -0.6, -0.5, 0.4, 0.4, 0.4],
  bias: -0.2,
  thresholds: { low: 0.3, high: 0.7 },
};

export const MIN_RELIABLE_WORDS = 150;

export const DISCLAIMER =
  "Style suggestions improve clarity. They are not a way to hide AI use. Check your institution's rules on AI-assisted writing and disclose use where required.";

const TRANSITIONS = new Set([
  "however", "moreover", "furthermore", "additionally", "consequently",
  "therefore", "thus", "hence", "nevertheless", "nonetheless", "accordingly",
]);

// Common function words. Phrases made only of these are left out of the explanations shown to readers
// (they still count in the score) because they say little on their own.
const FUNCTION_WORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "from", "by", "with", "as", "and", "or", "but",
  "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "these", "those", "there", "their",
  "they", "he", "she", "his", "her", "we", "you", "i", "not", "no", "so", "if", "than", "then", "can", "will",
  "would", "has", "have", "had", "do", "does", "did", "which", "who", "what", "also", "into", "about",
]);

const FIRST_PERSON = new Set([
  "i", "me", "my", "mine", "myself", "we", "us", "our", "ours", "ourselves",
  "i'm", "i've", "i'll", "i'd",
]);

// Phrases that often appear in machine-written prose. Matching ignores case and treats
// curly and straight apostrophes as the same character.
export const AI_PHRASES = [
  "delve", "delves into", "delving into", "tapestry", "testament to", "in today's",
  "in today's fast-paced", "it is important to note", "it's important to note",
  "it is worth noting", "it's worth noting", "in conclusion", "in summary",
  "furthermore", "moreover", "additionally", "crucial", "pivotal", "multifaceted",
  "underscore", "underscores", "showcase", "showcases", "realm", "in the realm of",
  "landscape", "leverage", "leveraging", "robust", "seamless", "seamlessly", "foster",
  "fostering", "embark", "navigate the complexities", "plays a crucial role",
  "play a crucial role", "game-changer", "unlock", "unleash", "vibrant", "intricate",
  "meticulous", "groundbreaking", "transformative", "holistic", "synergy", "paradigm",
  "ever-evolving", "rapidly evolving", "it is essential", "it's essential",
  "a wide range of", "a myriad of", "shed light on", "lay the foundation",
  "pave the way", "cutting-edge", "comprehensive", "empower", "elevate", "notably",
  "at this point in time", "due to the fact that", "in order to", "utilize", "utilizes",
  "utilized",
];

// Wordy phrases with an exact plain equivalent. Only these are changed automatically. Keys are
// normalised (lower case, straight apostrophes, single spaces). See normKey().
// Each one must keep the meaning and the grammar in any sentence; anything less certain belongs in
// PHRASE_ADVICE, where the author chooses.
export const SAFE_REPLACEMENTS = {
  "it is important to note that": "note that",
  "it's important to note that": "note that",
  "it is worth noting that": "note that",
  "it's worth noting that": "note that",
  "it is worth mentioning that": "note that",
  "it should be noted that": "note that",
  "in order to": "to",
  "due to the fact that": "because",
  "owing to the fact that": "because",
  "in light of the fact that": "because",
  "despite the fact that": "although",
  "in spite of the fact that": "although",
  "at this point in time": "now",
  "at the present time": "now",
  "in the event that": "if",
  "prior to": "before",
  "subsequent to": "after",
  "with regard to": "about",
  "in regard to": "about",
  "a large number of": "many",
  "a significant number of": "many",
  "a myriad of": "many",
  "a plethora of": "many",
  "the majority of the": "most of the",
  "the majority of": "most",
  "is able to": "can",
  "are able to": "can",
  "has the ability to": "can",
  "have the ability to": "can",
  "make use of": "use",
  "makes use of": "uses",
  "made use of": "used",
  "utilize": "use",
  "utilizes": "uses",
  "utilized": "used",
  "utilizing": "using",
  "utilise": "use",
  "utilises": "uses",
  "utilised": "used",
  "utilising": "using",
  "in close proximity to": "near",
  "on a daily basis": "daily",
  "on a regular basis": "regularly",
  "first and foremost": "first",
  "each and every": "every",
  "serves as a": "is a",
  "serves as an": "is an",
  "served as a": "was a",
  "served as an": "was an",
  "delve into": "examine",
  "delves into": "examines",
  "delved into": "examined",
  "delving into": "examining",
  "in the realm of": "in",
  "make a decision": "decide",
  "makes a decision": "decides",
  "made a decision": "decided",
  "reach a conclusion": "conclude",
  "reached a conclusion": "concluded",
  "give consideration to": "consider",
  "take into consideration": "consider",
  "takes into consideration": "considers",
  "took into consideration": "considered",
  "has an impact on": "affects",
  "have an impact on": "affect",
  "had an impact on": "affected",
  "is indicative of": "indicates",
  "are indicative of": "indicate",
  "for all intents and purposes": "in effect",
};

// Words and phrases common in machine-written prose, with plainer options the author can pick.
// An empty string means "delete it" (for openers such as "Moreover,").
export const PHRASE_ADVICE = {
  "moreover,": ["", "also,"],
  "furthermore,": ["", "also,"],
  "additionally,": ["", "also,"],
  "notably,": ["", "in particular,"],
  "ultimately,": ["", "in the end,"],
  "overall,": [""],
  "in conclusion,": ["", "to conclude,", "finally,"],
  "in summary,": ["", "in short,"],
  "importantly,": [""],
  "in today's fast-paced world,": [""],
  "in today's digital age,": ["today,", ""],
  "in today's world,": ["today,", ""],
  "in the ever-evolving landscape of": ["in"],
  "in the ever-evolving world of": ["in"],
  "delve": ["examine", "look at"],
  "delves": ["examines", "looks at"],
  "dive into": ["look at", "examine"],
  "dive deeper into": ["look more closely at"],
  "tapestry": ["mix", "range"],
  "a testament to": ["proof of", "evidence of"],
  "stands as a testament to": ["shows", "proves"],
  "crucial": ["important", "key", "essential"],
  "pivotal": ["key", "central"],
  "vital": ["important", "essential"],
  "multifaceted": ["complex", "varied"],
  "intricate": ["complex", "detailed"],
  "intricacies": ["details", "complexities"],
  "nuanced": ["subtle", "detailed"],
  "underscore": ["show", "highlight"],
  "underscores": ["shows", "highlights"],
  "underscoring": ["showing", "highlighting"],
  "showcase": ["show", "display"],
  "showcases": ["shows", "displays"],
  "showcasing": ["showing", "displaying"],
  "realm": ["field", "area"],
  "landscape": ["field", "situation"],
  "leverage": ["use", "draw on"],
  "leverages": ["uses", "draws on"],
  "leveraging": ["using", "drawing on"],
  "harness": ["use"],
  "harnessing": ["using"],
  "robust": ["strong", "reliable"],
  "seamless": ["smooth"],
  "seamlessly": ["smoothly"],
  "foster": ["encourage", "build"],
  "fosters": ["encourages", "builds"],
  "fostering": ["encouraging", "building"],
  "embark on": ["start", "begin"],
  "embarked on": ["started", "began"],
  "navigate": ["handle", "deal with"],
  "navigating": ["handling", "dealing with"],
  "navigate the complexities of": ["deal with", "handle"],
  "plays a crucial role in": ["is central to", "matters for"],
  "play a crucial role in": ["are central to", "matter for"],
  "plays a vital role in": ["is central to", "matters for"],
  "plays a pivotal role in": ["is central to", "drives"],
  "game-changer": ["major change", "breakthrough"],
  "unlock": ["open up", "enable"],
  "unleash": ["release"],
  "vibrant": ["lively"],
  "bustling": ["busy"],
  "meticulous": ["careful", "thorough"],
  "meticulously": ["carefully"],
  "groundbreaking": ["new", "original"],
  "transformative": ["major", "far-reaching"],
  "holistic": ["overall", "whole"],
  "synergy": ["cooperation"],
  "paradigm": ["model", "approach"],
  "ever-evolving": ["changing"],
  "rapidly evolving": ["fast-changing"],
  "a wide range of": ["many", "various"],
  "a wide array of": ["many", "various"],
  "a diverse range of": ["many", "various"],
  "shed light on": ["explain", "clarify"],
  "sheds light on": ["explains", "clarifies"],
  "lay the foundation for": ["prepare for", "support"],
  "lays the foundation for": ["prepares for", "supports"],
  "pave the way for": ["enable", "lead to"],
  "paves the way for": ["enables", "leads to"],
  "cutting-edge": ["latest", "advanced"],
  "state-of-the-art": ["latest", "advanced"],
  "comprehensive": ["full", "thorough"],
  "empower": ["enable", "help"],
  "empowers": ["enables", "helps"],
  "empowering": ["enabling", "helping"],
  "elevate": ["raise", "improve"],
  "enhance": ["improve"],
  "enhances": ["improves"],
  "enhancing": ["improving"],
  "facilitate": ["help", "enable"],
  "facilitates": ["helps", "enables"],
  "commence": ["begin", "start"],
  "commences": ["begins", "starts"],
  "endeavor": ["effort", "attempt"],
  "endeavour": ["effort", "attempt"],
  "embrace": ["adopt", "accept"],
  "embracing": ["adopting", "accepting"],
  "garnered": ["gained", "won"],
  "boasts": ["has"],
  "noteworthy": ["notable"],
  "commendable": ["good", "praiseworthy"],
  "valuable insights": ["useful findings", "lessons"],
  "insights into": ["findings on", "understanding of"],
  "key takeaways": ["main points"],
  "resonate with": ["appeal to"],
  "resonates with": ["appeals to"],
  "aligns with": ["fits", "matches"],
  "align with": ["fit", "match"],
  "journey": ["process", "path"],
  "streamline": ["simplify"],
  "streamlines": ["simplifies"],
};

// ---------- text helpers ----------

const WORD_RE = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu;

const normWord = (t) => t.toLowerCase().replace(/’/g, "'");

export function normKey(s) {
  return s.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ").trim();
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
}

// Builds one regex that matches any of the phrases, longest first, on whole-word boundaries.
function phraseRegex(phrases) {
  const alts = [...phrases]
    .sort((a, b) => b.length - a.length)
    .map((p) => escapeRe(p).replace(/\s+/g, "\\s+").replace(/'/g, "['’]"));
  return new RegExp(`(?<!\\p{L})(?:${alts.join("|")})(?!\\p{L})`, "giu");
}

const AI_RE = phraseRegex(AI_PHRASES);
const REPLACE_RE = phraseRegex(Object.keys(SAFE_REPLACEMENTS));

export function tokenize(text) {
  return String(text || "").match(WORD_RE) || [];
}

export function splitSentences(text) {
  return String(text || "")
    .split(/(?<=[.!?…])["'”’)\]]*\s+|\n\s*\n/u)
    .map((s) => s.trim())
    .filter((s) => tokenize(s).length > 0);
}

export function findAiPhrases(text) {
  return [...String(text || "").matchAll(AI_RE)].map((m) => ({ phrase: m[0], index: m.index }));
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const sd = (xs) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

function windowedTTR(words, size) {
  if (!words.length) return 0;
  if (words.length < size) return new Set(words).size / words.length;
  let total = 0;
  let windows = 0;
  for (let i = 0; i + size <= words.length; i += size) {
    total += new Set(words.slice(i, i + size)).size / size;
    windows += 1;
  }
  return total / windows;
}

function starterShare(sentences) {
  if (sentences.length < 3) return 0;
  const counts = new Map();
  for (const s of sentences) {
    const first = normWord(tokenize(s)[0]);
    counts.set(first, (counts.get(first) || 0) + 1);
  }
  return Math.max(...counts.values()) / sentences.length;
}

// ---------- features ----------

export function extractFeatures(text) {
  const raw = String(text || "");
  const tokens = tokenize(raw);
  const words = tokens.length;
  const lower = tokens.map(normWord);
  const sentences = splitSentences(raw);
  const sentenceLengths = sentences.map((s) => tokenize(s).length);
  const per100 = (x) => (words ? (x / words) * 100 : 0);
  const count = (re) => (raw.match(re) || []).length;

  const values = {
    meanSentenceLength: mean(sentenceLengths),
    sentenceLengthSD: sd(sentenceLengths),
    meanWordLength: mean(tokens.map((t) => [...t].length)),
    longWordShare: words ? tokens.filter((t) => [...t].length >= 9).length / words : 0,
    windowedTTR: windowedTTR(lower, 100),
    commaRate: per100(count(/,/g)),
    semicolonColonRate: per100(count(/[;:]/g)),
    dashRate: per100(count(/[—–]|--/g)),
    exclaimRate: per100(count(/!/g)),
    contractionRate: per100(count(/\p{L}+['’](?:t|s|re|ve|ll|d|m)\b/giu)),
    firstPersonRate: per100(lower.filter((t) => FIRST_PERSON.has(t)).length),
    transitionRate: per100(lower.filter((t) => TRANSITIONS.has(t)).length),
    aiPhraseRate: words ? (findAiPhrases(raw).length / words) * 1000 : 0,
    starterRepetition: starterShare(sentences),
  };
  return { words, sentences: sentences.length, values };
}

// ---------- word and phrase (n-gram) features ----------

// Counts lower-case words and two-word phrases.
export function ngramCounts(text) {
  const words = tokenize(text).map(normWord);
  const counts = new Map();
  const add = (g) => counts.set(g, (counts.get(g) || 0) + 1);
  for (let i = 0; i < words.length; i++) {
    add(words[i]);
    if (i + 1 < words.length) add(`${words[i]} ${words[i + 1]}`);
  }
  return counts;
}

// log(1 + count), scaled so the vector over the model's vocabulary has length 1.
export function ngramVector(counts, has) {
  const terms = [];
  let norm = 0;
  for (const [g, c] of counts) {
    if (!has(g)) continue;
    const v = Math.log1p(c);
    terms.push([g, v]);
    norm += v * v;
  }
  norm = Math.sqrt(norm) || 1;
  return terms.map(([g, v]) => [g, v / norm]);
}

const ngramMaps = new WeakMap();
function ngramMap(model) {
  if (!model.ngrams) return null;
  if (!ngramMaps.has(model)) ngramMaps.set(model, new Map(Object.entries(model.ngrams)));
  return ngramMaps.get(model);
}

// ---------- scoring ----------

export function validateModel(model) {
  const n = model?.features?.length;
  const ok =
    Array.isArray(model?.features) &&
    n > 0 &&
    [model.means, model.sds, model.weights].every((a) => Array.isArray(a) && a.length === n) &&
    typeof model.bias === "number" &&
    (model.ngrams === undefined || (typeof model.ngrams === "object" && !Array.isArray(model.ngrams)));
  if (!ok) throw new Error("This file is not a valid model: it needs features, means, sds, weights and bias.");
  return model;
}

// Phrase-level contributions of a text under a model with n-gram weights.
function phraseContributions(text, model) {
  const weights = ngramMap(model);
  if (!weights) return [];
  return ngramVector(ngramCounts(text), (g) => weights.has(g)).map(([g, x]) => ({
    phrase: g,
    contribution: x * weights.get(g),
  }));
}

// Scores each sentence on word and phrase choice alone. Higher = more like the AI texts the model saw.
// Returns [] for a model without n-gram weights.
export function scoreSentences(text, model = DEFAULT_MODEL) {
  if (!ngramMap(model)) return [];
  const raw = String(text || "");
  const threshold = model.sentenceThreshold ?? 0.5;
  const out = [];
  let from = 0;
  for (const sentence of splitSentences(raw)) {
    const index = raw.indexOf(sentence, from);
    if (index >= 0) from = index + sentence.length;
    const parts = phraseContributions(sentence, model);
    const score = parts.reduce((a, p) => a + p.contribution, 0);
    const cues = parts
      .filter((p) => p.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 4)
      .map((p) => p.phrase);
    out.push({ sentence, index, score: Math.round(score * 1000) / 1000, aiLike: score >= threshold && tokenize(sentence).length >= 6, cues });
  }
  return out;
}

// Returns a 0–100 score (higher = more like AI-generated writing on these measures).
export function scoreText(text, model = DEFAULT_MODEL) {
  validateModel(model);
  const f = extractFeatures(text);
  if (f.words === 0) throw new Error("Paste some text first.");

  const contributions = model.features.map((name, i) => {
    const value = f.values[name];
    if (value === undefined) throw new Error(`The model uses an unknown feature: ${name}`);
    const z = clamp((value - model.means[i]) / (model.sds[i] || 1), -4, 4);
    return { feature: name, value, contribution: z * model.weights[i] };
  });

  const phrases = phraseContributions(text, model);
  const logit =
    model.bias +
    contributions.reduce((acc, c) => acc + c.contribution, 0) +
    phrases.reduce((acc, p) => acc + p.contribution, 0);
  const probability = 1 / (1 + Math.exp(-logit));
  const th = model.thresholds || DEFAULT_MODEL.thresholds;
  const band = probability >= th.high ? "more-ai" : probability <= th.low ? "more-human" : "inconclusive";
  const bandText = {
    "more-ai": "More like AI-generated writing on these measures",
    "more-human": "More like human writing on these measures",
    inconclusive: "Inconclusive: the measures point both ways",
  }[band];

  const signals = [...contributions]
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
    .slice(0, 5)
    .map((c) => ({
      feature: c.feature,
      label: FEATURE_LABELS[c.feature] || c.feature,
      value: Math.round(c.value * 100) / 100,
      contribution: Math.round(c.contribution * 100) / 100,
      effect: c.contribution > 0 ? "pushes toward AI-like" : "pushes toward human-like",
    }));

  const notes = [];
  if (f.words < MIN_RELIABLE_WORDS) {
    notes.push(`The text has ${f.words} words. Scores on texts under ${MIN_RELIABLE_WORDS} words are unstable.`);
  }
  if (model.kind === "uncalibrated-prior") {
    notes.push("This uses the built-in default model, which is not calibrated on labelled data. Treat the score as a rough indicator only.");
  }
  const tm = model.training?.test_metrics;
  if (tm) {
    notes.push(`This model was right on ${(tm.accuracy * 100).toFixed(1)}% of ${tm.n.toLocaleString("en")} test texts it had never seen, and wrongly flagged ${(tm.falsePositiveRate * 100).toFixed(1)}% of human texts. Expect lower accuracy on newer AI models, edited AI text, and genres it was not trained on.`);
  }
  notes.push("Non-native English writers and formal academic prose can be flagged in error. Do not use a score alone as evidence of misconduct.");

  const byWeight = (sign) =>
    phrases
      .filter((p) => Math.sign(p.contribution) === sign && !p.phrase.split(" ").every((w) => FUNCTION_WORDS.has(w)))
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 6)
      .map((p) => p.phrase);

  return {
    score: Math.round(probability * 100),
    band,
    bandText,
    words: f.words,
    sentences: f.sentences,
    reliable: f.words >= MIN_RELIABLE_WORDS,
    signals,
    phrases: { ai: byWeight(1), human: byWeight(-1) },
    notes,
    model: model.name || model.kind,
  };
}

// ---------- style editing (humanizer) ----------

const ADVICE_RE = phraseRegex(Object.keys(PHRASE_ADVICE).map((k) => k.replace(/,$/, "")));

function matchCase(replacement, original) {
  const first = original.charAt(0);
  if (first && first !== first.toLowerCase() && replacement) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function excerpt(text, index, length) {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return (start > 0 ? "…" : "") + text.slice(start, end).replace(/\s+/g, " ") + (end < text.length ? "…" : "");
}

const PATTERNS = [
  {
    kind: "pattern",
    re: /,\s+(?:prompting|leading to|resulting in|sparking|triggering|causing|highlighting|underscoring|signalling|signaling|marking|raising concerns|fuelling|fueling|reflecting)\b[^.!?]{0,120}/gi,
    message: 'A comma followed by "prompting", "leading to", "resulting in" or similar is a common machine-writing pattern. It chains two events and implies a cause. Split it into two sentences in time order, and attribute any cause.',
  },
  {
    kind: "pattern",
    re: /\bnot only\b[^.!?]{1,120}?\bbut also\b/gi,
    message: '"Not only … but also" is a common machine-writing pattern. A plain "and" or two short sentences often reads better.',
  },
  {
    kind: "pattern",
    re: /\b(?:it(?:'|’)s|it is|this is) not (?:just|only|merely|simply) [^.!?]{1,80}?[,;—–-]\s*(?:it(?:'|’)s|it is|but)\b/gi,
    message: '"It\'s not just X, it\'s Y" is a stock contrast in machine-written prose. State the point directly.',
  },
  {
    kind: "pattern",
    re: /(?:^|[.!?]\s+)Whether you(?:'|’)re [^.!?]{1,80}? or [^.!?]{1,80}?,/g,
    message: '"Whether you\'re X or Y, …" is a stock opener in machine-written prose. Address the reader directly or cut it.',
  },
  {
    kind: "pattern",
    re: /\b(?:let(?:'|’)s|let us) (?:dive|delve|explore|take a (?:closer )?look)\b/gi,
    message: '"Let\'s dive in / explore" is a stock transition. Start with the point itself.',
  },
];

const PASSIVE_RE = /\b(?:is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?\w+(?:ed|en)\b/i;

// Suggestions on `text`. Indexes refer to `text`, so the page can apply an alternative in place.
function buildSuggestions(text, model) {
  const out = [];

  // Word and phrase choices, each with plainer options.
  for (const m of text.matchAll(ADVICE_RE)) {
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 1);
    const withComma = after === "," && PHRASE_ADVICE[`${normKey(m[0])},`];
    const key = withComma ? `${normKey(m[0])},` : normKey(m[0]);
    const alternatives = PHRASE_ADVICE[key];
    if (!alternatives) continue;
    const phrase = withComma ? `${m[0]},` : m[0];
    out.push({
      kind: "phrase",
      index: m.index,
      length: phrase.length,
      phrase,
      alternatives,
      excerpt: excerpt(text, m.index, phrase.length),
      message: `"${phrase}" is common in machine-written prose.`,
    });
  }

  for (const p of PATTERNS) {
    for (const m of text.matchAll(p.re)) {
      const index = m.index + Math.max(0, m[0].search(/[A-Za-z]/));
      out.push({ kind: p.kind, index, length: m[0].length - (index - m.index), excerpt: excerpt(text, index, 60), message: p.message });
    }
  }

  // Sentences the trained model reads as machine-written (needs a model with word/phrase weights).
  const sentences = splitSentences(text);
  for (const s of scoreSentences(text, model)) {
    if (!s.aiLike) continue;
    out.push({
      kind: "sentence",
      index: s.index,
      length: s.sentence.length,
      excerpt: s.sentence,
      cues: s.cues,
      message: `This sentence reads as AI-written to the model${s.cues.length ? ` (it weighs: ${s.cues.map((c) => `"${c}"`).join(", ")})` : ""}. Rewrite it in your own words: add a specific detail, example, figure or source, or change its structure.`,
    });
  }

  // Very long sentences.
  let from = 0;
  for (const s of sentences) {
    const index = text.indexOf(s, from);
    if (index >= 0) from = index + s.length;
    const n = tokenize(s).length;
    if (n > 40) {
      out.push({ kind: "long", index, length: s.length, excerpt: excerpt(text, index, 80), message: `This sentence has ${n} words. Consider splitting it.` });
    }
  }

  const dashes = (text.match(/[—–]|--/g) || []).length;
  if (dashes >= 3) {
    out.push({
      kind: "dashes",
      message: `${dashes} dashes. Heavy use of dashes is often associated with machine-written prose. Consider commas, brackets or full stops in some places.`,
    });
  }

  if (sentences.length >= 8) {
    const counts = new Map();
    for (const s of sentences) {
      const w = normWord(tokenize(s)[0]);
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    const [word, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n / sentences.length >= 0.25) {
      out.push({ kind: "openings", message: `${n} of ${sentences.length} sentences begin with "${word}". Vary the openings where the meaning allows.` });
    }

    const lengths = sentences.map((s) => tokenize(s).length);
    const m = mean(lengths);
    if (m > 0 && sd(lengths) / m < 0.35) {
      out.push({ kind: "uniform", message: "Sentence lengths are very even. Mix short and long sentences where the meaning allows." });
    }

    const passive = sentences.filter((s) => PASSIVE_RE.test(s)).length;
    if (passive / sentences.length > 0.4) {
      out.push({ kind: "passive", message: `${passive} of ${sentences.length} sentences use the passive voice. Where the actor matters, name it ("We measured…" rather than "It was measured…").` });
    }
  }

  const tokens = tokenize(text).map(normWord);
  const transitions = tokens.filter((t) => TRANSITIONS.has(t));
  if (tokens.length && transitions.length >= 3 && (transitions.length / tokens.length) * 100 > 2) {
    out.push({ kind: "transitions", message: `${transitions.length} transition words (for example "${transitions[0]}"). Keep only the ones the argument needs.` });
  }

  return out.sort((a, b) => (a.index ?? 1e9) - (b.index ?? 1e9));
}

// Replaces one suggested phrase with the chosen alternative. An empty alternative deletes the phrase
// (and the space after it) and capitalises the next word when the phrase opened a sentence.
export function applyAlternative(text, suggestion, alternative) {
  const { index, length, phrase } = suggestion;
  let at = index;
  if (text.slice(at, at + length).toLowerCase() !== phrase.toLowerCase()) {
    at = text.toLowerCase().indexOf(phrase.toLowerCase());
    if (at < 0) return text;
  }
  const before = text.slice(0, at);
  let after = text.slice(at + length);
  const original = text.slice(at, at + length);
  if (alternative === "") {
    after = after.replace(/^\s+/, "");
    const sentenceStart = /(^|[.!?]\s*)$/.test(before);
    if (sentenceStart) after = after.charAt(0).toUpperCase() + after.slice(1);
    return before + after;
  }
  return before + matchCase(alternative, original) + after;
}

// Only the automatic corrections (SAFE_REPLACEMENTS), without suggestions or scoring. Used by the website's AI
// tools on their own answers (lib/house-style.js). Returns { text, changes: [{ from, to, index }] }.
export function applySafeReplacements(text) {
  const changes = [];
  const out = String(text || "").replace(REPLACE_RE, (match, offset) => {
    const to = matchCase(SAFE_REPLACEMENTS[normKey(match)], match);
    changes.push({ from: match, to, index: offset });
    return to;
  });
  return { text: out, changes };
}

// Returns the edited text (when apply is true), each automatic change, and suggestions the author
// should review. Only SAFE_REPLACEMENTS are applied automatically. Suggestion indexes refer to the
// returned text. Pass a trained model to also mark sentences that read as AI-written.
export function styleEdit(text, { apply = true, model = DEFAULT_MODEL } = {}) {
  const raw = String(text || "");
  const changes = [];
  const replaced = raw.replace(REPLACE_RE, (match, offset) => {
    const to = matchCase(SAFE_REPLACEMENTS[normKey(match)], match);
    changes.push({ from: match, to, index: offset });
    return to;
  });
  const result = apply ? replaced : raw;
  return {
    text: result,
    changes,
    suggestions: buildSuggestions(result, model),
    disclaimer: DISCLAIMER,
  };
}
