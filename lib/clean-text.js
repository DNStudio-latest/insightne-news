// Removes the hidden characters AI writing tools can leave in text (zero-width spaces, invisible
// direction marks, "tag" characters, soft hyphens, odd non-breaking spaces). Readers never see them,
// but they can mark a text as machine-made. Runs on every story before it is saved (lib/db.js).
// The zero-width joiner and non-joiner are kept between Bengali, Hindi, Assamese or Nepali letters,
// where they are a real part of the spelling.

const HIDDEN = /[​‎‏‪-‮⁠-⁤⁦-⁩﻿­᠎͏]|[\u{E0000}-\u{E007F}]/gu;
const ODD_SPACES = /[    - 　]/g;
const JOINERS = /[‌‍]/g;
const INDIC = /[ऀ-෿]/;

export function cleanText(text) {
  if (typeof text !== "string" || !text) return text;
  return text
    .replace(HIDDEN, "")
    .replace(ODD_SPACES, " ")
    .replace(JOINERS, (joiner, i, all) => (INDIC.test(all[i - 1] || "") && INDIC.test(all[i + 1] || "") ? joiner : ""))
    .normalize("NFC");
}

// The story fields readers see. Translations ({ hi: { headline, summary }, … }) and gallery captions too.
const FIELDS = ["headline", "summary", "body", "headline_bn", "summary_bn", "body_bn", "image_caption", "image_credit", "author"];

export function cleanStoryText(story) {
  if (!story || typeof story !== "object") return story;
  const out = { ...story };
  for (const f of FIELDS) if (typeof out[f] === "string") out[f] = cleanText(out[f]);
  if (out.translations && typeof out.translations === "object") {
    out.translations = Object.fromEntries(
      Object.entries(out.translations).map(([lang, t]) => [lang, t && typeof t === "object" ? Object.fromEntries(Object.entries(t).map(([k, v]) => [k, cleanText(v)])) : t]),
    );
  }
  if (Array.isArray(out.gallery)) out.gallery = out.gallery.map((g) => (g && typeof g === "object" ? { ...g, caption: cleanText(g.caption) } : g));
  return out;
}
