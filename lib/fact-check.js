// A fact check for AI-written news briefs: every figure, month, name and quotation in the brief must also appear in the
// sources it was written from (their headlines and snippets). Anything that does not is listed as a reason; a brief
// with reasons is marked NEEDS EXTRA CHECK, so it can never be published automatically and waits for a person.
//
// It is a plain, free check (no AI). It can wrongly flag a correct brief (for example, a name spelled differently);
// that only means a person looks at it. It cannot prove a brief is right: it only catches things the sources do not say.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
// ("one" is left out on purpose: "one of the…" is not a figure; "twenty-one" is still read correctly below.)
const NUMBER_WORDS = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };

// Capitalised words that are not names: titles, institutions, sentence openers, places the site always covers.
const COMMON = new Set(
  `the a an and or but in on at by for with from to of as after before during while when where who which that this these those he she they it his her their its
  our we i you police officials official authorities authority government govt centre center state states district districts city town village minister ministers chief
  secretary director general commissioner officer officers member members mla mp party leader leaders president vice prime court high supreme bench judge
  department ministry commission committee council board assembly legislative parliament lok sabha rajya national central union indian india northeast
  north east west south eastern northeastern region regional local public people residents students teachers workers farmers women men children
  border security force forces army air navy reserve bureau investigation agency university college school institute hospital bank corporation municipal
  election elections vote poll polls bjp congress cpi cpim tipra motha trinamool tmc inc nda indi alliance
  monday tuesday wednesday thursday friday saturday sunday today yesterday tomorrow
  according said says added told asked reported announced stated confirmed meanwhile however also
  news report reports reported briefing meeting programme program scheme project projects plan plans
  assam tripura meghalaya manipur mizoram nagaland arunachal pradesh sikkim bengal bangladesh myanmar bhutan nepal china delhi kolkata mumbai agartala guwahati shillong
  imphal aizawl kohima itanagar gangtok dispur silchar dibrugarh tezu belonia udaipur dharmanagar kailashahar khowai
  jan feb mar apr jun jul aug sep sept oct nov dec
  bharatiya janata indian national communist marxist trinamool tipraland autonomous service services administrative forest revenue health
  imd ndrf sdrf bsf crpf cm dm sp
  actor actress games new inspector constable sub sir madam shri smt dr mr mrs`
    .split(/\s+/)
    .filter(Boolean),
);

const BENGALI = /[ঀ-৿]/g;
const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

// Lower-case text with Bengali digits as 0-9, commas removed inside numbers and month abbreviations spelled out.
function normalize(text) {
  let t = String(text || "").toLowerCase();
  t = t.replace(/[০-৯]/g, (d) => String(BENGALI_DIGITS.indexOf(d)));
  t = t.replace(/(\d),(?=\d)/g, "$1");
  t = t.replace(/\b(jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b\.?/g, (m, a) => MONTHS.find((x) => x.startsWith(a === "sept" ? "sep" : a)) || m);
  return t;
}

const SCALES = { thousand: 1e3, lakh: 1e5, lakhs: 1e5, million: 1e6, crore: 1e7, crores: 1e7, billion: 1e9 };

// The figures in a text, as plain digits ("15 thousand" and "15,000" are both "15000"). A source may say "3 lakh" in
// one place and "300,000" in another, so for sources both the 3 and the 300000 count; for a brief only the 300000 does.
function figuresIn(text, { forSource = false } = {}) {
  const out = new Set();
  // "thirty-five" is one figure (35), not 30 and 5.
  const t = normalize(text).replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/g, (_, tens, ones) => String(NUMBER_WORDS[tens] + (NUMBER_WORDS[ones] || 1)));
  for (const m of t.matchAll(/(\d+(?:\.\d+)?)(\s+(thousand|lakhs?|million|crores?|billion)\b)?/g)) {
    const plain = m[1].replace(/\.0+$/, "");
    if (m[3]) {
      out.add(String(Math.round(Number(m[1]) * SCALES[m[3]])));
      if (forSource) out.add(plain);
    } else out.add(plain);
  }
  for (const m of t.matchAll(/\b[a-z]+\b/g)) if (NUMBER_WORDS[m[0]]) out.add(String(NUMBER_WORDS[m[0]]));
  return out;
}

// "may" and "march" are also ordinary words, so they count as months only next to a day number ("May 5", "5 March").
function monthsIn(text) {
  const t = normalize(text);
  return new Set(MONTHS.filter((m) => (m === "may" || m === "march" ? new RegExp(`\\b${m}\\s+\\d|\\d\\s+${m}\\b`).test(t) : new RegExp(`\\b${m}\\b`).test(t))));
}

const letters = (s) => s.toLowerCase().replace(/[^\p{L}]/gu, "");

// Capitalised words in the text that could be names (not the usual titles and openers).
// acronyms: abbreviations found in the sources. A brief often spells one out ("Indira Gandhi Government College" for
// IGGC), so the words of such a run count as found.
function nameWordsIn(text, acronyms = []) {
  const found = new Set();
  const upper = (w) => /^\p{Lu}/u.test(w);
  for (const sentence of String(text || "").split(/(?<=[.!?])\s+/)) {
    const raw = sentence.split(/\s+/).map((r) => r.replace(/^[("'“‘]+|[)"'”’.,;:!?]+$/g, "").replace(/['’]s$/i, ""));
    // Capitalised, with a lower-case letter somewhere: all-capitals (BSF, VB-GRAMG) are abbreviations, "H.M" is initials.
    // Hyphenated words ("Sub-Inspector", "UK-based", "Mid-Day") are compounds, not names.
    const isName = (w) => w.length >= 3 && upper(w) && /\p{Ll}/u.test(w) && !w.includes(".") && !w.includes("-");
    const explained = new Set();
    for (const a of acronyms) {
      for (let i = 0; i < raw.length; i++) {
        let initials = "";
        for (let j = i; j < raw.length && j < i + 9; j++) {
          if (upper(raw[j])) initials += raw[j][0];
          else if (!/^(of|and|for|the|in|on)$/i.test(raw[j])) break;
          if (initials === a && upper(raw[j])) {
            for (let k = i; k <= j; k++) explained.add(k);
            break;
          }
          if (initials.length >= a.length) break;
        }
      }
    }
    raw.forEach((w, i) => {
      if (!isName(w) || explained.has(i)) return;
      const low = letters(w);
      if (!low || COMMON.has(low) || MONTHS.includes(low)) return;
      // A capitalised word that only starts a sentence ("Readers can …") is not a name; two capitalised words in a row are.
      if (i === 0 && !isName(raw[1] || "")) return;
      found.add(w);
    });
  }
  return found;
}

// sources: the headlines and snippets the brief was written from, and the names of the news sites (an array of
// strings). Names are checked in the summary only: headlines are written in Title Case, so every word looks like a name.
// Returns a list of short reasons (empty when everything in the brief appears in the sources).
export function checkSummaryFacts({ headline = "", summary = "" } = {}, sources = []) {
  const brief = `${headline}. ${summary}`;
  const joined = sources.filter(Boolean).join(" \n ");
  if (!brief.trim() || !joined.trim()) return [];
  const reasons = [];

  const sourceFigures = figuresIn(joined, { forSource: true });
  const badFigures = [...figuresIn(brief)].filter((f) => !sourceFigures.has(f));
  if (badFigures.length) reasons.push(`Fact check: the figure${badFigures.length > 1 ? "s" : ""} ${badFigures.map((f) => `"${f}"`).join(", ")} ${badFigures.length > 1 ? "are" : "is"} not in the sources`);

  const sourceMonths = monthsIn(joined);
  const badMonths = [...monthsIn(brief)].filter((m) => !sourceMonths.has(m));
  if (badMonths.length) reasons.push(`Fact check: the month ${badMonths.join(", ")} is not in the sources`);

  // Quotations must be word for word in a source.
  const flat = (s) => normalize(s).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  const flatSources = flat(joined);
  for (const m of brief.matchAll(/[“"]([^”"\n]{12,})[”"]/g)) {
    if (!flatSources.includes(flat(m[1]))) {
      reasons.push(`Fact check: the quotation "${m[1].slice(0, 50)}" is not word for word in the sources`);
      break;
    }
  }

  // Names are not compared when the sources are mostly Bengali: an English brief spells those names its own way.
  const bengaliShare = (joined.match(BENGALI) || []).length / Math.max(1, joined.length);
  if (bengaliShare < 0.2) {
    const sourceWords = new Set(joined.split(/[^\p{L}]+/u).map(letters).filter(Boolean));
    const sourceList = [...sourceWords];
    const acronyms = [...new Set(joined.match(/\b[A-Z]{2,8}\b/g) || [])];
    const missing = [...nameWordsIn(summary, acronyms)].filter((w) => {
      const low = letters(w);
      if (sourceWords.has(low)) return false;
      // Plurals and endings: "Mizoram's", "Agartalas" — a source word that starts the same way counts.
      return !(low.length >= 5 && sourceList.some((s) => s.length >= 5 && (s.startsWith(low.slice(0, low.length - 1)) || low.startsWith(s.slice(0, s.length - 1)))));
    });
    if (missing.length) reasons.push(`Fact check: ${missing.length > 4 ? `${missing.length} names` : `the name${missing.length > 1 ? "s" : ""} ${missing.slice(0, 4).map((w) => `"${w}"`).join(", ")}`} not in the sources`);
  }
  return reasons;
}
