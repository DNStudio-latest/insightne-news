// The languages readers can choose. English is the original; the others are translated by Gemini
// (Bengali can also be written by hand in the editors). Safe to use in the browser too.
export const LANGUAGES = [
  { code: "en", name: "English", english: "English" },
  { code: "bn", name: "বাংলা", english: "Bengali" },
  { code: "hi", name: "हिन्दी", english: "Hindi" },
  { code: "as", name: "অসমীয়া", english: "Assamese" },
  { code: "ne", name: "नेपाली", english: "Nepali" },
  { code: "trp", name: "Kokborok (Roman)", english: "Kokborok", html: "trp" },
  // The same Kokborok, spelled in Bengali letters: many readers in Tripura read it that way.
  { code: "trpb", name: "ককবরক (বাংলা লিপি)", english: "Kokborok (Bengali script)", html: "trp-Beng" },
];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const TRANSLATED = LANGUAGE_CODES.filter((c) => c !== "en");
export const validLang = (code) => (LANGUAGE_CODES.includes(code) ? code : "en");
// The language tag for the page's lang="" attribute (Kokborok in Bengali letters is "trp-Beng").
export const htmlLang = (code) => LANGUAGES.find((l) => l.code === code)?.html || validLang(code);

// A story's text in a language: Bengali lives in its own columns (headline_bn …), the others in "translations".
export function storyText(story, field, code) {
  if (!story) return "";
  if (code === "bn") return story[`${field}_bn`]?.trim() || story[field] || "";
  if (code !== "en") {
    const t = story.translations || {};
    // Kokborok in Bengali letters shows the Roman version until it has been written (before English).
    return t[code]?.[field]?.trim() || (code === "trpb" && t.trp?.[field]?.trim()) || story[field] || "";
  }
  return story[field] || "";
}

// The translations stored after a save. A changed English text clears the machine versions (they are made again at
// the next run), but a Kokborok version typed in the same form is kept. `kok` (Roman script) and `kokBn` (Bengali
// script) are each { headline, summary } to set it, null to remove it (the collector writes it again), or undefined
// when the form had no such boxes.
export function translationsAfterEdit(existing, englishChanged, kok, kokBn) {
  const out = englishChanged ? {} : { ...(existing?.translations || {}) };
  for (const [code, value] of [["trp", kok], ["trpb", kokBn]]) {
    if (value === undefined) continue;
    if (value) out[code] = value;
    else delete out[code];
  }
  return out;
}

// Which translations a story still needs.
export function missingLanguages(story) {
  return TRANSLATED.filter((code) => (code === "bn" ? !story.summary_bn?.trim() : !story.translations?.[code]?.summary?.trim()));
}
