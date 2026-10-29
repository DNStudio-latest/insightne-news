// Safety checks done by the computer, not the AI, on every draft:
// - every quote must appear word for word in a source document, otherwise it gets [CHECK];
// - every number must appear in a source document, otherwise it gets [CHECK].

const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

// Same text with simple differences removed: line breaks, curly quotes, Bengali digits.
export function normalize(text) {
  return String(text || "")
    .replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)))
    .replace(/[“”„‟"]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/-\s*\n\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

const QUOTE = /[“"]([^“”"]{8,}?)[”"]/g;

// Returns { text, problems } with [CHECK] added after anything that is not in the sources.
export function checkDraft(text, sourceTexts) {
  const source = normalize(sourceTexts.join("\n"));
  // Every run of digits in the sources counts, also inside "10th" or "Rs.325".
  const sourceNumbers = new Set((source.match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, "")));
  const problems = [];

  let out = String(text).replace(QUOTE, (whole, inner) => {
    if (source.includes(normalize(inner))) return whole;
    problems.push(`Quote not found word for word in the source: "${inner.slice(0, 60)}"`);
    return `${whole} [CHECK: quote not found word for word in the source]`;
  });

  // Numbers inside [CHECK ...] notes and web addresses are skipped.
  out = out.replace(/(\[CHECK[^\]]*\]|https?:\/\/\S+)|(?<![\w.])\d[\d,]*(?:\.\d+)?(?![\w])/g, (match, skip) => {
    if (skip) return match;
    const number = match.replace(/,+$/, ""); // "10," in "November 10, 2026" is the number 10
    if (sourceNumbers.has(number.replace(/,/g, ""))) return match;
    problems.push(`Number not found in the source: ${number}`);
    return `${number} [CHECK]${match.slice(number.length)}`;
  });
  return { text: out, problems };
}

export const hasCheckMarks = (text) => /\[(CHECK|DELETED POST)[^\]]*\]/.test(String(text || ""));
