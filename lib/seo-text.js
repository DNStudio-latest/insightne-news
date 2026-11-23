// How a story's headline and summary appear in Google results. Google shows about 60 characters of the title and
// about 155 of the description; anything longer is cut off with "…", and a long title also loses the site name.
import { settings } from "./config.js";

const TITLE_ROOM = 62; // characters Google usually shows
const DESCRIPTION_ROOM = 155;

// Next adds " · InsightNE News" after every title. When the headline plus that ending would not fit, the ending is left
// off, so the headline itself is not cut short earlier.
export function searchTitle(headline) {
  const text = String(headline || "").replace(/\s+/g, " ").trim();
  const withSite = `${text} · ${settings.siteName}`;
  return [...withSite].length > TITLE_ROOM ? { absolute: text } : text;
}

// The summary cut at the end of a sentence (or a word) so it fits the 155 characters Google shows.
export function searchDescription(summary) {
  const text = String(summary || "").replace(/\s+/g, " ").trim();
  const chars = [...text];
  if (chars.length <= DESCRIPTION_ROOM) return text;
  const cut = chars.slice(0, DESCRIPTION_ROOM).join("");
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("। "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (sentence >= 70) return cut.slice(0, sentence + 1);
  const space = cut.lastIndexOf(" ");
  return `${cut.slice(0, space > 70 ? space : DESCRIPTION_ROOM - 1).replace(/[\s,;:–—-]+$/, "")}…`;
}
