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

// Phrases with a plainer replacement. Only these are changed automatically. Keys are
// normalised (lower case, straight apostrophes, single spaces). See normKey().
export const SAFE_REPLACEMENTS = {
  "it is important to note that": "note that",
  "it's important to note that": "note that",
  "it is worth noting that": "note that",
  "it's worth noting that": "note that",
  "in order to": "to",
  "due to the fact that": "because",
  "at this point in time": "now",
  "delve into": "explore",
  "delves into": "explores",
  "delving into": "exploring",
  "utilize": "use",
  "utilizes": "uses",
  "utilized": "used",
  "in conclusion,": "overall,",
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

// ---------- scoring ----------

export function validateModel(model) {
  const n = model?.features?.length;
  const ok =
    Array.isArray(model?.features) &&
    n > 0 &&
    [model.means, model.sds, model.weights].every((a) => Array.isArray(a) && a.length === n) &&
    typeof model.bias === "number";
  if (!ok) throw new Error("This file is not a valid model: it needs features, means, sds, weights and bias.");
  return model;
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

  const logit = model.bias + contributions.reduce((acc, c) => acc + c.contribution, 0);
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
  notes.push("Non-native English writers and formal academic prose can be flagged in error. Do not use a score alone as evidence of misconduct.");

  return {
    score: Math.round(probability * 100),
    band,
    bandText,
    words: f.words,
    sentences: f.sentences,
    reliable: f.words >= MIN_RELIABLE_WORDS,
    signals,
    notes,
    model: model.name || model.kind,
  };
}

// ---------- style editing (humanizer) ----------

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

function buildSuggestions(text, changes = []) {
  const out = [];
  const fixed = (i) => changes.some((c) => i >= c.index && i < c.index + c.from.length);
  for (const hit of findAiPhrases(text)) {
    if (fixed(hit.index)) continue;
    out.push({
      kind: "phrase",
      index: hit.index,
      excerpt: excerpt(text, hit.index, hit.phrase.length),
      message: `"${hit.phrase}": consider a plainer, more specific wording.`,
    });
  }

  const dashes = (text.match(/[—–]|--/g) || []).length;
  if (dashes >= 3) {
    out.push({
      kind: "dashes",
      message: `${dashes} dashes. Heavy use of dashes is often associated with machine-written prose. Consider commas, brackets or full stops in some places.`,
    });
  }

  const sentences = splitSentences(text);
  if (sentences.length >= 8) {
    const counts = new Map();
    for (const s of sentences) {
      const w = normWord(tokenize(s)[0]);
      counts.set(w, (counts.get(w) || 0) + 1);
    }
    const [word, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (n / sentences.length >= 0.25) {
      out.push({
        kind: "openings",
        message: `${n} of ${sentences.length} sentences begin with "${word}". Vary the openings where the meaning allows.`,
      });
    }

    const lengths = sentences.map((s) => tokenize(s).length);
    const m = mean(lengths);
    if (m > 0 && sd(lengths) / m < 0.35) {
      out.push({
        kind: "uniform",
        message: "Sentence lengths are very even. Mix short and long sentences where the meaning allows.",
      });
    }
  }

  const tokens = tokenize(text).map(normWord);
  const transitions = tokens.filter((t) => TRANSITIONS.has(t));
  if (tokens.length && transitions.length >= 3 && (transitions.length / tokens.length) * 100 > 2) {
    out.push({
      kind: "transitions",
      message: `${transitions.length} transition words (for example "${transitions[0]}"). Keep only the ones the argument needs.`,
    });
  }

  return out.sort((a, b) => (a.index ?? 1e9) - (b.index ?? 1e9));
}

// Returns the edited text (when apply is true), each automatic change, and suggestions
// the author should review. Only the plain-filler replacements are applied automatically.
export function styleEdit(text, { apply = true } = {}) {
  const raw = String(text || "");
  const changes = [];
  const replaced = raw.replace(REPLACE_RE, (match, offset) => {
    const to = matchCase(SAFE_REPLACEMENTS[normKey(match)], match);
    changes.push({ from: match, to, index: offset });
    return to;
  });
  return {
    text: apply ? replaced : raw,
    changes,
    suggestions: buildSuggestions(raw, changes),
    disclaimer: DISCLAIMER,
  };
}
