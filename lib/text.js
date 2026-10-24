// Small helpers for cleaning text from news feeds and checking our summaries.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };

export function cleanText(html = "", maxLength = 400) {
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/The post .* appeared first on .*$/i, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > maxLength ? text.slice(0, maxLength).replace(/\s+\S*$/, "") + "…" : text;
}

// The same article can appear with tracking codes on the end of its address.
// This removes them so we can tell when two links are really the same page.
export function normalizeUrl(url) {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|ref$|amp$)/i.test(key)) u.searchParams.delete(key);
    }
    u.hostname = u.hostname.replace(/^www\./, "");
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

function words(text) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
}

// Returns the first run of `runLength` words that appears in both texts, or null.
// We use it to catch a summary that repeats the original article's wording.
export function findCopiedPhrase(summary, originals, runLength = 8) {
  const ours = words(summary);
  const theirs = new Set();
  for (const original of originals) {
    const w = words(original || "");
    for (let i = 0; i + runLength <= w.length; i++) theirs.add(w.slice(i, i + runLength).join(" "));
  }
  for (let i = 0; i + runLength <= ours.length; i++) {
    const phrase = ours.slice(i, i + runLength).join(" ");
    if (theirs.has(phrase)) return phrase;
  }
  return null;
}

// A safety net in addition to Claude's judgement: if any of these words appear,
// the story is always marked NEEDS EXTRA CHECK.
const SENSITIVE = [
  ["violence", /\b(kill(ed|ing|s)?|murder(ed)?|attack(ed)?|assault(ed)?|clash(es|ed)?|riot(s|ing)?|violence|violent|lynch(ed|ing)?|shot dead|stabbed|bomb(ing)?|militant(s)?|insurgen(t|ts|cy)|encounter|curfew)\b/i],
  ["religion or community", /\b(communal|religio(n|us)|temple|mosque|church|hindu|muslim|christian|buddhist|tribal|tribe|caste|ethnic|community tension|migrant(s)?|infiltrat(or|ors|ion))\b/i],
  ["elections", /\b(election(s)?|poll(s|ing)?|vote(s|d|rs)?|voting|ballot|evm|candidate(s)?|by-?election|bypoll)\b/i],
  ["accident", /\b(accident(s)?|crash(ed|es)?|collision|drown(ed|ing)?|fire broke|blaze|collapse(d)?|injured|dead|died|death(s)?)\b/i],
  ["crime", /\b(arrest(ed|s)?|rape(d)?|molest(ed|ation)?|abduct(ed|ion)|kidnap(ped|ping)?|smuggl(ing|ed|er|ers)|drug(s)? (seized|haul)|fir\b|accused|chargesheet|police case|custody)\b/i],
  ["rumour", /\b(rumou?r(s|ed)?|allegedly|unconfirmed|viral video|fake news|claims? without)\b/i],
];

export function sensitiveKeywordReasons(text) {
  return SENSITIVE.filter(([, re]) => re.test(text)).map(([label]) => `Mentions ${label}`);
}
