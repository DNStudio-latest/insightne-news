// What goes on a news poster (see app/poster/[slug]/route.js). Every word is taken from the story itself (its headline,
// summary and text): nothing is written or guessed, so a poster can never state a fact the story does not. Sentences
// are used whole, never cut, so attribution ("police said", "alleged") always stays with its claim.
import crypto from "node:crypto";
import { pictureOf } from "./proof-shot.js";
import { settings } from "./config.js";
import { AI_CREDIT } from "./images.js";

const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];

// A story gets a poster when it is published and has a picture (a real photo or a labelled AI illustration).
export const posterEligible = (story) => story?.status === "approved" && Boolean(pictureOf(story));

// The website shows a news graphic (the story's AI illustration with its place, date and headline on it) instead of the
// plain AI illustration. Only pictures already labelled as AI illustrations: a real photo is never given text.
export const usesGraphic = (story) => settings.poster?.webGraphics !== false && posterEligible(story) && story.image_credit === AI_CREDIT;

// The address of the graphic: size "card" (1024 wide, for cards) or "full" (1600 wide, for the lead and the story page).
// The v= part changes when the story's words or picture change, so browsers may keep the picture for a year.
export function graphicUrl(story, size = "card") {
  const v = crypto.createHash("md5").update(`${story.headline}|${story.summary}|${story.image_url}|${story.region}|${story.published_at}`).digest("hex").slice(0, 8);
  return `/poster/${story.slug}?variant=web&size=${size === "full" ? "full" : "card"}&v=${v}`;
}

// "TRIPURA | NOVEMBER 19" (the day in Indian time).
export function dateline(story) {
  const place = story.region === "Northeast" ? "NORTHEAST INDIA" : String(story.region || "").toUpperCase();
  const d = new Date(new Date(story.published_at || Date.now()).getTime() + 5.5 * 3600 * 1000);
  return [place, `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`].filter(Boolean).join(" | ");
}

// Whole sentences of a text, in order.
export function sentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])["”']?\s+(?=[A-Z0-9"“'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Up to `max` short whole sentences from the story for the key-points box, none repeating the headline or the
// supporting line.
export function keyPoints(story, supporting, max = 3, maxLength = 100) {
  const seen = [norm(story.headline), norm(supporting)].filter(Boolean).map((t) => new Set(t.split(" ")));
  // The same news in other words: most of the shorter sentence's words are already in an earlier one.
  const repeats = (s) => {
    const w = new Set(norm(s).split(" "));
    return seen.some((o) => {
      const shared = [...w].filter((x) => o.has(x)).length;
      return shared >= 3 && shared / Math.min(w.size, o.size) >= 0.55;
    });
  };
  const out = [];
  for (const s of [...sentences(story.summary), ...sentences(story.body)]) {
    if (out.length >= max) break;
    if (s.length > maxLength || repeats(s) || /^(read|follow|get|subscribe|click)\b/i.test(s)) continue;
    seen.push(new Set(norm(s).split(" ")));
    out.push(s);
  }
  return out;
}

// The headline split into words, with the key ones marked for the yellow highlight: figures (with "Rs" before them),
// abbreviations such as BSF, and the longest capitalised noun after the first word (not a verb ending in -s, -ed, -ing).
export function headlineWords(headline) {
  const words = String(headline || "").trim().split(/\s+/).map((text) => ({ text, key: false }));
  words.forEach((w, i) => {
    if (/\d/.test(w.text) || /^[A-Z]{2,}[.,]?$/.test(w.text)) {
      w.key = true;
      if (i > 0 && /^rs\.?$/i.test(words[i - 1].text)) words[i - 1].key = true;
    }
  });
  let noun = -1;
  words.forEach((w, i) => {
    const t = w.text.replace(/[^A-Za-z]/g, "");
    if (i === 0 || w.key || !/^[A-Z][a-z]{5,}$/.test(t) || /(s|ed|ing)$/.test(t)) return;
    if (noun < 0 || t.length > words[noun].text.replace(/[^A-Za-z]/g, "").length) noun = i;
  });
  if (noun >= 0) words[noun].key = true;
  return words;
}

export function posterContent(story) {
  const supporting = sentences(story.summary)[0] && sentences(story.summary)[0].length <= 160 ? sentences(story.summary)[0] : "";
  const sub = norm(supporting) === norm(story.headline) ? "" : supporting;
  return {
    dateline: dateline(story),
    headline: String(story.headline || "").trim(),
    words: headlineWords(story.headline),
    supporting: sub,
    points: keyPoints(story, sub),
    breaking: Boolean(story.is_breaking),
    aiPicture: false, // set by the route (needs the story's image credit)
  };
}
