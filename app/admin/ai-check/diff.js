// Word-by-word comparison of the original and the edited text, for the "What changed" view.
// Paragraph breaks count as tokens, so the view keeps the article's paragraphs.

const PARA = "\n\n";
const MAX_CELLS = 6_000_000; // about 2,400 words a side; longer texts are not compared

export function tokens(text) {
  return (String(text || "").match(/\S+|\n\s*\n/g) || []).map((t) => (/^\s+$/.test(t) ? PARA : t));
}

// Returns [{ type: "same" | "del" | "ins", text }] with neighbouring tokens of the same type joined,
// or null when the texts are too long to compare.
export function wordDiff(before, after) {
  const a = tokens(before);
  const b = tokens(after);
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) return null;
  // Longest common subsequence table, filled from the end.
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  }
  const out = [];
  const push = (type, text) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.parts.push(text);
    else out.push({ type, parts: [text] });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { push("same", a[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) push("del", a[i++]);
    else push("ins", b[j++]);
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("ins", b[j++]);
  return out.map(({ type, parts }) => ({ type, text: parts.join(" ").replace(/ ?\n\n ?/g, PARA) }));
}

// Words removed and added (paragraph breaks not counted).
export function diffCounts(segments) {
  const count = (type) => segments.filter((s) => s.type === type).reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0);
  return { removed: count("del"), added: count("ins") };
}
