// The languages readers can choose. English is the original; the others are translated by Gemini
// (Bengali can also be written by hand in the editors). Safe to use in the browser too.
export const LANGUAGES = [
  { code: "en", name: "English", english: "English" },
  { code: "bn", name: "বাংলা", english: "Bengali" },
  { code: "hi", name: "हिन्दी", english: "Hindi" },
  { code: "as", name: "অসমীয়া", english: "Assamese" },
  { code: "ne", name: "नेपाली", english: "Nepali" },
];
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);
export const TRANSLATED = LANGUAGE_CODES.filter((c) => c !== "en");
export const validLang = (code) => (LANGUAGE_CODES.includes(code) ? code : "en");

// A story's text in a language: Bengali lives in its own columns (headline_bn …), the others in "translations".
export function storyText(story, field, code) {
  if (!story) return "";
  if (code === "bn") return story[`${field}_bn`]?.trim() || story[field] || "";
  if (code !== "en") return story.translations?.[code]?.[field]?.trim() || story[field] || "";
  return story[field] || "";
}

// Which translations a story still needs.
export function missingLanguages(story) {
  return TRANSLATED.filter((code) => (code === "bn" ? !story.summary_bn?.trim() : !story.translations?.[code]?.summary?.trim()));
}
