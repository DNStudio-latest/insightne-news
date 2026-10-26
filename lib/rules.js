// No-AI mode: simple rules instead of Claude. Costs nothing.
// Used automatically when no Claude key is set. Summaries are left empty for you to write.

const TRIPURA_WORDS = [
  "tripura", "agartala", "dharmanagar", "kailashahar", "belonia", "khowai", "ambassa", "teliamura", "sabroom",
  "kamalpur", "bishalgarh", "sonamura", "santirbazar", "melaghar", "amarpur", "jirania", "mohanpur", "kumarghat",
  "panisagar", "gandacherra", "gandachara", "longtharai", "sepahijala", "gomati", "unakoti", "dhalai", "tipra motha",
  "tbse", "ttaadc", "tripura state rifles", "boxanagar", "bishramganj", "kanchanpur", "jampuijala", "takarjala",
  "kakraban", "jolaibari", "karbook", "chailengta", "salema", "kadamtala", "churaibari", "damchhara", "hezamara",
  "charilam", "matabari", "tripura sundari", "radhakishorepur", "manu", "ganganagar", "kathalia",
];
const TRIPURA_BENGALI = ["ত্রিপুরা", "আগরতলা", "ধর্মনগর", "কৈলাসহর", "বিলোনিয়া", "খোয়াই", "আমবাসা", "তেলিয়ামুড়া", "সাব্রুম", "উদয়পুর", "গোমতী", "ঊনকোটি"];

// Place names for each of the eight states (English, then Bengali).
const STATE_WORDS = {
  Tripura: [TRIPURA_WORDS, TRIPURA_BENGALI],
  Assam: [
    ["assam", "guwahati", "dispur", "silchar", "jorhat", "dibrugarh", "tezpur", "karimganj", "sribhumi", "barak valley", "bodoland", "btr",
      "kokrajhar", "nagaon", "tinsukia", "sivasagar", "doomdooma", "golaghat", "barpeta", "dhubri", "cachar", "hailakandi", "majuli", "bongaigaon", "goalpara", "lakhimpur", "himanta"],
    ["আসাম", "অসম", "গুয়াহাটি", "শিলচর", "করিমগঞ্জ", "কাছাড়"],
  ],
  Meghalaya: [["meghalaya", "shillong", "tura", "jowai", "garo hills", "khasi", "jaintia", "ghadc", "khadc", "nongpoh", "conrad sangma"], ["মেঘালয়", "শিলং"]],
  Manipur: [["manipur", "imphal", "churachandpur", "bishnupur", "thoubal", "ukhrul", "moreh", "kangpokpi", "jiribam", "meitei", "kuki-zo"], ["মণিপুর", "ইম্ফল"]],
  Mizoram: [["mizoram", "aizawl", "lunglei", "champhai", "kolasib", "mizo"], ["মিজোরাম", "আইজল"]],
  Nagaland: [["nagaland", "kohima", "dimapur", "mokokchung", "tuensang", "wokha", "zunheboto", "nscn", "hornbill"], ["নাগাল্যান্ড", "কোহিমা", "ডিমাপুর"]],
  "Arunachal Pradesh": [["arunachal", "itanagar", "pasighat", "tawang", "ziro", "naharlagun", "bomdila", "tezu", "siang"], ["অরুণাচল"]],
  Sikkim: [["sikkim", "gangtok", "namchi", "pelling", "nathula", "nathu la"], ["সিকিম", "গ্যাংটক"]],
};
const NORTHEAST_ONLY = [["northeast", "north-east", "north east", "seven sisters"], ["উত্তর-পূর্ব", "উত্তর পূর্ব"]];

// Places outside the Northeast: a Tripura paper's story about them is probably national news.
const ELSEWHERE = /\b(rajasthan|bihar|delhi|mumbai|kolkata|west bengal|uttar pradesh|kerala|tamil nadu|karnataka|maharashtra|gujarat|punjab|haryana|jharkhand|odisha|telangana|andhra|kashmir|hyderabad|bengaluru|bangalore|chennai|pune|pakistan|china|bangladesh|nepal|us|usa|trump|uk|russia|ukraine|israel|gaza|odi|t20|ipl|bcci|world cup|india vs|ind vs)\b/i;
const ELSEWHERE_BENGALI = ["দিল্লি", "কলকাতা", "পশ্চিমবঙ্গ", "ওড়িশা", "বিহার", "মুম্বাই", "পাকিস্তান", "চীন", "বাংলাদেশ", "আমেরিকা", "রাশিয়া", "প্রধানমন্ত্রী", "কেন্দ্রীয়", "নির্মলা", "খার্গে", "আরবিআই", "ইউপিআই", "উজবেকিস্তান"];

// Foreign places and bodies: a story about them goes under "World"; other news from outside the Northeast goes under "India".
const FOREIGN = /\b(pakistan|china|chinese|bangladesh|nepal|bhutan|myanmar|sri lanka|afghanistan|america|american|trump|biden|britain|russia|ukraine|israel|gaza|iran|iraq|syria|korea|japan|uzbekistan|europe|united nations|nato|g20|g7|world bank|imf)\b/i;
const FOREIGN_CAPS = /\b(US|USA|UK|EU|UN)\b/;
const FOREIGN_BENGALI = ["পাকিস্তান", "চীন", "বাংলাদেশ", "নেপাল", "ভুটান", "মায়ানমার", "আমেরিকা", "রাশিয়া", "ইউক্রেন", "ইসরায়েল", "ইরান", "কোরিয়া", "জাপান", "উজবেকিস্তান", "রাষ্ট্রসংঘ"];

// National or world news is kept only when it is big news like this.
const BIG_NEWS = /\b(prime minister|pm modi|president|supreme court|parliament|lok sabha|rajya sabha|union cabinet|union budget|rbi|election commission|isro|army|war|terror(ist|ism)?|attack|earthquake|cyclone|flood(s)?|summit|gdp|inflation)\b/i;
const BIG_NEWS_BENGALI = ["প্রধানমন্ত্রী", "রাষ্ট্রপতি", "সুপ্রিম কোর্ট", "সংসদ", "লোকসভা", "রাজ্যসভা", "আরবিআই", "নির্বাচন কমিশন", "ইসরো", "সন্ত্রাস", "যুদ্ধ", "ভূমিকম্প"];

// Stories with these words matter to many people: +1.
const IMPORTANT = /\b(government|govt|cabinet|chief minister|minister|high court|supreme court|court|budget|scheme|policy|flood(s|ed)?|landslide(s)?|cyclone|earthquake|alert|warning|curfew|bandh|strike|protest(s)?|election(s)?|poll(s)?|exam(s|ination)?|results?|hospital|health|price(s)?|power cut|water supply|road|highway|railway|train|airport|border)\b/i;

// Entertainment, adverts and business promotions: −3.
const LOW_VALUE = /\b(horoscope|zodiac|rashifal|ott|trailer|box office|bollywood|tollywood|actor|actress|celebrity|sponsored|brand|mall|jewel(le)?ry|showroom|ipo|stock market|sensex|nifty|shares?|recipe|fashion|lifestyle|gadget|smartphone|launches|offer(s)?|discount|sale)\b/i;

const TOPIC_WORDS = {
  Politics: /\b(bjp|congress|cpi\s?\(?m\)?|cpim|tipra motha|tmc|trinamool|ipft|minister|chief minister|mla(s)?|mp(s)?|assembly|election(s)?|poll(s)?|party|opposition|governor|cabinet|by-?election|panchayat|parliament|lok sabha|rajya sabha|vidhan sabha)\b/gi,
  Education: /\b(school(s)?|college(s)?|universit(y|ies)|exam(s|ination)?|student(s)?|teacher(s)?|tbse|cbse|admission(s)?|scholarship(s)?|education|campus|iit|nit|board results?)\b/gi,
  Sports: /\b(cricket|football|match|tournament|league|trophy|medal(s)?|athlete(s)?|olympic(s)?|championship|ranji|sport(s)?|player(s)?|stadium|wicket|goal(s)?|boxing|badminton|kabaddi)\b/gi,
};

const STOPWORDS = new Set("the a an and or of in on at to for from by with as is are was were be been has have had will would after over under into about amid says said new news state govt government two three four five more than this that these those its their his her who what when where why how not no".split(" "));

function hasWord(text, words) {
  const lower = text.toLowerCase();
  return words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[-\s]/g, "[-\\s]?")}([^a-z]|$)`).test(lower));
}

const hasBengali = (text, words) => words.some((w) => text.includes(w));

export function isTripura(text) {
  return hasWord(text, TRIPURA_WORDS) || hasBengali(text, TRIPURA_BENGALI);
}

// The states a text mentions, e.g. ["Assam"].
export function statesIn(text) {
  return Object.entries(STATE_WORDS)
    .filter(([, [en, bn]]) => hasWord(text, en) || hasBengali(text, bn))
    .map(([state]) => state);
}

export function isNortheast(text) {
  const [en, bn] = NORTHEAST_ONLY;
  return statesIn(text).length > 0 || hasWord(text, en) || hasBengali(text, bn);
}

export function isForeign(text) {
  return FOREIGN.test(text) || FOREIGN_CAPS.test(text) || hasBengali(text, FOREIGN_BENGALI);
}

const isBigNews = (text) => BIG_NEWS.test(text) || hasBengali(text, BIG_NEWS_BENGALI);
const localToTripuraPaper = (a) =>
  a.sourceRegion === "Tripura" && !ELSEWHERE.test(a.title) && !hasBengali(a.title, ELSEWHERE_BENGALI) && !isForeign(a.title);

// Is this article about the Northeast? (Otherwise it is national or world news.)
export function aboutNortheast(a) {
  if (isNortheast(a.title)) return true;
  if (localToTripuraPaper(a)) return true;
  return isNortheast(a.snippet || "") && !isForeign(a.title);
}

// One state if the story is clearly about one; "Northeast" if it is about several or the region as a whole;
// "World" for foreign news and "India" for other national news.
// sourceRegion "Tripura" means it came from a Tripura paper, whose local stories often don't name the state.
export function ruleRegion(articles) {
  for (const field of ["title", "snippet"]) {
    const found = [...new Set(articles.flatMap((a) => statesIn(a[field] || "")))];
    if (found.length === 1) return found[0];
    if (found.length > 1) return "Northeast";
  }
  if (articles.some((a) => isNortheast(a.title))) return "Northeast";
  if (articles.some(localToTripuraPaper)) return "Tripura";
  if (articles.some((a) => aboutNortheast(a))) return "Northeast";
  return articles.some((a) => isForeign(a.title)) ? "World" : "India";
}

// Every Northeast state counts; Tripura, which InsightNE covers most closely, gets one extra point.
// National and world news starts lower and only big news reaches the minimum score.
export function ruleScore({ title, snippet = "", sourceRegion }) {
  let score;
  if (!aboutNortheast({ title, snippet, sourceRegion })) {
    score = 4 + (IMPORTANT.test(title) ? 1 : 0) + (isBigNews(title) ? 2 : 0) - (LOW_VALUE.test(`${title} ${snippet}`) ? 3 : 0);
    return Math.max(1, Math.min(8, score));
  }
  if (isTripura(title)) score = 8;
  else if (statesIn(title).length) score = 7;
  else if (isNortheast(title)) score = 6;
  else if (sourceRegion === "Tripura" && !ELSEWHERE.test(title) && !hasBengali(title, ELSEWHERE_BENGALI)) score = 6;
  else if (isTripura(snippet)) score = 6;
  else if (isNortheast(snippet)) score = 5;
  else score = 3;
  const text = `${title} ${snippet}`;
  if (IMPORTANT.test(title)) score += 1;
  if (LOW_VALUE.test(text)) score -= 3;
  return Math.max(1, Math.min(9, score));
}

export function ruleTopic(text, topics) {
  let best = null;
  let bestCount = 0;
  for (const topic of topics) {
    const re = TOPIC_WORDS[topic];
    const count = re ? (text.match(re) || []).length : 0;
    if (count > bestCount) [best, bestCount] = [topic, count];
  }
  return best;
}

function keyWords(title) {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
      .map((w) => w.replace(/(ies|es|s)$/, "")),
  );
}

// Two headlines are "the same news" when most of the important words of the shorter one appear in the other.
export function sameNews(a, b) {
  const wa = keyWords(a);
  const wb = keyWords(b);
  const shared = [...wa].filter((w) => wb.has(w)).length;
  if (shared < 3) return false;
  if (shared / Math.min(wa.size, wb.size) >= 0.6) return true;
  // Same place + two more shared words (e.g. "pistol", "police", "Boxanagar") within two days: same news.
  return [...wa].some((w) => wb.has(w) && (isTripura(w) || isNortheast(w)));
}

export function createRulesAi({ topics = [] } = {}) {
  return {
    model: "no-AI mode (simple rules)",
    noAi: true,

    async score(articles) {
      return new Map(articles.map((a) => [a.id, ruleScore(a)]));
    },

    async group(articles, existingStories) {
      const groups = [];
      for (const a of articles) {
        const group = groups.find((g) => g.titles.some((t) => sameNews(t, a.title)));
        if (group) {
          group.articleIds.push(a.id);
          group.titles.push(a.title);
        } else {
          groups.push({ articleIds: [a.id], titles: [a.title], existingStoryId: null });
        }
      }
      for (const g of groups) {
        const match = existingStories.find((s) => g.titles.some((t) => sameNews(t, s.headline)));
        if (match) g.existingStoryId = match.id;
      }
      return groups.map(({ articleIds, existingStoryId }) => ({ articleIds, existingStoryId }));
    },

    // No writing here: the headline is the original one (you can edit it) and the summary is left for you.
    async summarize(articles) {
      const main = articles.find((a) => isTripura(a.title)) || articles[0];
      const text = articles.map((a) => `${a.title} ${a.snippet}`).join(" ");
      return {
        headline: main.title,
        summary: "",
        region: ruleRegion(articles),
        topic: ruleTopic(text, topics),
        needsCheck: false,
        checkReasons: [],
      };
    },
  };
}
