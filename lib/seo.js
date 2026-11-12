// Search-engine details for pages that exist in more than one language: the page's own address (canonical) and the
// matching addresses in the other searchable languages (hreflang). A page counts as translated when the story or
// page really has text in that language; otherwise its canonical address is the English one.
import { langPath, INDEXED_LANGUAGES } from "./languages.js";

// path: the plain (English) address, e.g. "/story/x". translated: false when this language only shows English text.
export function alternatesFor(code, path, { translated = true } = {}) {
  const own = translated ? langPath(code, path) : path;
  const out = { canonical: own };
  if (translated && INDEXED_LANGUAGES.includes(code)) {
    out.languages = { ...Object.fromEntries(INDEXED_LANGUAGES.map((l) => [l, langPath(l, path)])), "x-default": path };
  }
  return out;
}

// Search engines should skip a page that only repeats the English text in another language.
export const noindexUnlessTranslated = (code, translated) => (code !== "en" && !translated ? { robots: { index: false, follow: true } } : {});
