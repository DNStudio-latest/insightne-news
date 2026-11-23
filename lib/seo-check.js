// The "Google check" for a story's headline and intro, shown while the reporter writes. Plain code with no imports,
// so the same rules run in the browser (admin editor) and on the server. It only warns; nothing is changed by itself.
// The same rules are repeated in the desktop tool (news-notes/tool/InsightNE-News-Tool.ps1): keep the two in step.

export const TITLE_GOOD = 60; // characters Google shows
export const TITLE_MAX = 70;
export const DESC_GOOD = 155;
export const DESC_MIN = 70;

// Words people type into Google. Left side: weaker newsroom wording; right side: what readers search for.
export const SEARCH_WORDS = [
  [/\b(dies|died|passes away|passed away|demise)\b/i, "death", "People search for “death”, not “dies” (for example “Jugamaya Dutta death”)."],
  [/\b(nab|nabs|nabbed|apprehended|apprehends|rounded up)\b/i, "arrested", "People search for “arrested”."],
  [/\b(mishap)\b/i, "accident", "People search for “accident”."],
  [/\b(lauds|hails)\b/i, "praises", "People search for “praises”."],
];

export const PLACES = [
  "Tripura", "Assam", "Meghalaya", "Manipur", "Mizoram", "Nagaland", "Arunachal", "Sikkim", "Northeast", "India",
  "Agartala", "Guwahati", "Shillong", "Imphal", "Aizawl", "Kohima", "Itanagar", "Gangtok", "Dibrugarh", "Silchar",
  "Dimapur", "Jorhat", "Tezpur", "Udaipur", "Dharmanagar", "Kailashahar", "Belonia", "Sabroom", "Khowai", "Ambassa",
  "Delhi", "Bangladesh", "Pakistan", "China", "Myanmar", "Bhutan",
];

const words = (s) => String(s || "").trim().split(/\s+/).filter(Boolean);
const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

// Returns [{ level: "ok" | "warn" | "bad", text }].
export function seoChecks({ headline = "", summary = "", region = "" } = {}) {
  const out = [];
  const h = clean(headline);
  const d = clean(summary);
  const add = (level, text) => out.push({ level, text });

  if (!h) {
    add("bad", "Write the headline first.");
  } else {
    const n = [...h].length;
    if (n <= TITLE_GOOD && n >= 35) add("ok", `Headline length is good (${n} characters; Google shows about 60).`);
    else if (n < 35) add("warn", `Headline is short (${n} characters). Say what happened, where and to whom.`);
    else if (n <= TITLE_MAX) add("warn", `Headline is ${n} characters. Google shows about 60, so the end may be cut: “${[...h].slice(0, TITLE_GOOD).join("").trim()}…”`);
    else add("bad", `Headline is ${n} characters. Google will cut it after about 60. Shorten it.`);

    const early = words(h).slice(0, 8).join(" ");
    const place = [region, ...PLACES].filter(Boolean).find((p) => new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(early));
    if (place) add("ok", `Place name is early in the headline (“${place}”).`);
    else add("warn", "Put the place (state or town) near the start, for example “Tripura: …” or “… in Agartala”. People search with the place name.");

    for (const [pattern, better, why] of SEARCH_WORDS) if (pattern.test(h)) add("warn", `${why} Try “${better}”.`);

    const letters = h.replace(/[^A-Za-z]/g, "");
    if (letters.length > 12 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.6) add("bad", "Too many capital letters. Use normal headline capitals, not ALL CAPS.");
    if (/!/.test(h)) add("warn", "Remove the exclamation mark. Google and readers trust calm, factual headlines more.");
    if (/\b(shocking|you won'?t believe|must see|unbelievable|stunning)\b/i.test(h)) add("warn", "Avoid clickbait words (“shocking”, “unbelievable”). State the fact instead.");
    if (/[.]$/.test(h)) add("warn", "A headline does not end with a full stop.");
    if (/\b(\d[\d,]*)\b/.test(h)) add("ok", "A number in the headline helps readers see what the story is about.");
  }

  if (!d) {
    add("bad", "The intro is empty, so Google will pick random text from the story for the search result. Write 1–2 sentences.");
  } else {
    const n = [...d].length;
    if (n < DESC_MIN) add("warn", `Intro is short (${n} characters). Add who, what, where and one fact (aim for 110–155).`);
    else if (n <= DESC_GOOD) add("ok", `Intro fits the search result (${n} characters).`);
    else {
      const cut = [...d].slice(0, DESC_GOOD).join("");
      add("warn", `Google shows only the first ~155 characters of the intro. Put the main fact first: “${cut.trim()}…”`);
    }
    if (h && d.toLowerCase().startsWith(h.toLowerCase().slice(0, 30))) add("warn", "The intro starts with the same words as the headline. Use it to add a new fact.");
  }
  return out;
}

// How the three levels are shown.
export const LEVEL_ICON = { ok: "✓", warn: "!", bad: "✗" };
