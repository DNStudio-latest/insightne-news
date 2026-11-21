// Warnings for the phone "News desk". They are warnings only: nothing blocks, you decide.
// The rules are the same as the Windows InsightNE News Tool (style sheet, legal and ethics screening). Not legal advice.

const RISK = [
  { key: "victim", level: "RED", title: "Sexual offence or victim identity", re: /\b(rape[ds]?|gang-?rape|molest\w*|sexual(ly)? (assault\w*|abus\w*|harass\w*)|POCSO|eve-?teas\w*)\b/gi,
    why: "Printing anything that can identify the victim of a sexual offence is a criminal offence (BNS section 72; for children also POCSO Act section 23). School, locality or family details can identify a victim without a name.",
    action: "Remove every identifying detail. No photo of the victim or family. Attribute facts to police or court records. Get a second source." },
  { key: "label", level: "RED", title: "Defamatory label for a person", re: /\b(thief|liar|goons?|criminals?|traitors?|anti-national|fraudsters?|murderers?|rapists?|terrorists?|cheaters?|scamsters?|looters?|dalals?|mafia)\b/gi,
    why: "Calling a named or identifiable person a thief, criminal, liar or similar in the paper's own voice is the classic basis of a defamation complaint (BNS section 356).",
    action: "Remove the label, or keep it only inside a direct, attributed quote and add the other side's response." },
  { key: "crime", level: "AMBER", title: "Crime, accusation or violence", re: /\b(arrest\w*|accused|murder\w*|kill\w*|fraud|scam|theft|stole\w*|bribe\w*|corrupt\w*|cheat\w*|smuggl\w*|drugs?|ganja|yaba|extort\w*|assault\w*|attack\w*|threat\w*|abduct\w*|kidnap\w*|embezzl\w*|forg\w*)\b/gi,
    why: "An accusation is not a finding of guilt. Naming a person next to a crime without a police, court or named-speaker source invites a defamation complaint.",
    action: "Attribute every crime claim to police, a court record or a named speaker. Include the accused's response or say it could not be obtained." },
  { key: "court", level: "AMBER", title: "Court or legal proceedings", re: /\b(court|judge|high court|supreme court|verdict|bail|FIR|charge-?sheet|sub judice|hearing|petition|writ|bench|tribunal)\b/gi,
    why: "Comment on a pending case, or on a judge, can amount to contempt of court (Contempt of Courts Act 1971).",
    action: "Report only what happened in open court or what the order says. No opinion on guilt or outcome." },
  { key: "communal-violence", level: "RED", title: "Communal or religious conflict", re: /\b(communal(ly)?|riots?|rioting|lynch\w*|jihad\w*|blasphem\w*)\b/gi,
    why: "Stories that can promote enmity between groups, or outrage religious feelings, can attract criminal action (BNS sections 196 and 299).",
    action: "Use only verified facts from police or officials. Do not name a community unless essential. Add independent confirmation." },
  { key: "community", level: "AMBER", title: "Religion, community or ethnicity mentioned", re: /\b(muslims?|hindus?|christians?|buddhists?|sikhs?|tribals?|non-tribals?|bengalis?|tripuris?|kokborok|mogs?|reang|jamatia|chakma|religio\w*|caste|dalits?)\b/gi,
    why: "Naming a community next to wrongdoing or a dispute can read as generalising (BNS sections 196 and 299, Press Council norms).",
    action: "Keep it only if the source said it and it is needed. Never generalise to a whole community." },
  { key: "nationality", level: "AMBER", title: "Immigration or nationality", re: /\b(bangladeshi|illegal immigrants?|infiltrat\w*|foreigners?|refugees?|rohingya)\b/gi,
    why: "Nationality labels are sensitive on the border and can be defamation if the person is not proved to be a foreign national.",
    action: "Attribute to police or an official order." },
  { key: "minor", level: "AMBER", title: "Child or minor mentioned", re: /\b(minors?|child|children|juveniles?|teenagers?|schoolgirls?|schoolboys?|aged (1[0-7]|[1-9]))\b/gi,
    why: "The identity of a child in conflict with law or a child victim must not be disclosed (Juvenile Justice Act section 74; POCSO Act section 23). A child's photo needs a guardian's consent.",
    action: "No name, photo, school, address or family detail of a child. Check the photo and the text." },
  { key: "suicide", level: "AMBER", title: "Suicide or self-harm", re: /\b(suicide|hanged|self-immolat\w*|ended (his|her|their) life|took (his|her|their) own life)\b/gi,
    why: "Press Council norms: no method, no place, no photo, no glorification, no single cause.",
    action: "Remove method and location. Avoid naming the person if the family has not agreed." },
  { key: "death", level: "AMBER", title: "Death, injury or accident", re: /\b(died|death|dead|dies|body|drowned|accident|injured|fatal|killed)\b/gi,
    why: "Naming a dead or injured person before the family is informed, or graphic detail or photos, is an ethics breach.",
    action: "Confirm identity and family notification from police or hospital. No graphic detail." },
  { key: "health", level: "AMBER", title: "Rumour, unverified claim or health content", re: /\b(rumou?rs?|viral|unverified|reportedly|fake news|misinformation|cure|vaccine|epidemic|outbreak|dengue|virus)\b/gi,
    why: "Repeating a rumour as news makes the paper a publisher of it. Health claims need an official or medical source.",
    action: "Name the source. Say it is unverified and who denied it." },
  { key: "security", level: "AMBER", title: "Security forces, insurgency or border", re: /\b(army|BSF|CRPF|troops?|insurgen\w*|militants?|NLFT|NDFB|extremists?|encounter|ambush)\b/gi,
    why: "Operational details can endanger lives. Reports that appear to support banned groups can attract UAPA action.",
    action: "Use official statements. No troop movements or unverified claims by a group." },
  { key: "election", level: "AMBER", title: "Election content", re: /\b(election|polls?|polling|votes?|voting|voters?|campaign\w*|candidates?|ballot|manifesto|booth|ward)\b/gi,
    why: "Election stories are subject to the Model Code of Conduct, the silence period before polling ends and the Press Council's paid-news rules. For municipal polls the State Election Commission's order applies.",
    action: "Check the polling end time in the SEC order. Keep wording neutral and attributed. No predictions of results." },
  { key: "election-promo", level: "AMBER", title: "Predictive or promotional election wording", re: /\b(historic victory|sure win|landslide|wave|sweep|will win|bound to win|certain to win|massive win|clean sweep)\b/gi,
    why: "Predicting a result or praising a party in the paper's own voice can read as paid news.",
    action: "Attribute to the speaker. Remove praise in the paper's own voice." },
  { key: "exitpoll", level: "RED", title: "Exit poll or survey", re: /\b(exit polls?|opinion polls?|survey predict\w*)\b/gi,
    why: "Publishing exit-poll results during the period set by law (Representation of the People Act section 126A; the SEC order for municipal polls) is an offence.",
    action: "Do not publish until polling has ended everywhere and the SEC order allows." },
  { key: "phone", level: "RED", title: "Phone number", re: /\b[6-9]\d{9}\b/g,
    why: "Publishing a private phone number is a privacy breach and can lead to harassment complaints.", action: "Remove the number unless it is an official helpline." },
  { key: "aadhaar", level: "RED", title: "Aadhaar-style number", re: /\b\d{4}\s\d{4}\s\d{4}\b/g,
    why: "A 12-digit ID number exposes the person to fraud and breaches privacy law.", action: "Remove it." },
  { key: "email", level: "RED", title: "Email address", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    why: "Private email addresses are personal data.", action: "Remove it unless it is an official public address." },
  { key: "address", level: "AMBER", title: "Home address", re: /\b(resident of|house no\.?|h\.?\s?no\.?|lane no\.?|road no\.?|door no\.?)\b/gi,
    why: "A home address can expose a person to retaliation and breaches privacy.", action: "Use only the locality or village, never the house." },
  { key: "sensational", level: "AMBER", title: "Sensational wording", re: /\b(shocking|slams?|slammed|blasts?|blasted|bombshell|exposed|scandal|explosive|outrageous|scathing)\b/gi,
    why: "Sensational wording makes a report look like opinion and weakens a truth defence.", action: "Use neutral verbs: said, stated, asked, criticised." },
];

const SENSITIVE = new Set(["victim", "crime", "death", "suicide", "health", "communal-violence", "community", "label", "minor"]);
const DATELINE = /^\w[\w ]*,\s*\w+ \d+\s*:/;
const words = (s) => String(s || "").split(/\s+/).filter(Boolean);
const sentences = (s) => String(s || "").split(/(?<=[.!?])\s+/).filter((x) => x.trim());

// item: { headline, intro, story, photo_caption, photo_url, speakers, caption_bn, gemini_text, no_video, no_photo }
// Returns { red, amber, rows: [{ level, area, what, detail }] }.
export function deskWarnings(item = {}) {
  const rows = [];
  const add = (level, area, what, detail) => rows.push({ level, area, what, detail });
  const head = String(item.headline || "").trim();
  const intro = String(item.intro || "").trim();
  const story = String(item.story || "").trim();
  const cap = String(item.photo_caption || "").trim();
  const all = [head, intro, story].join("\n");

  if (!story) {
    add("RED", "Story", "There is no story text yet", "Paste ChatGPT's reply and fill headline, intro and story first.");
    return finish(rows);
  }
  if (!DATELINE.test(story)) add("RED", "Style", 'Story does not start with a dateline like "Agartala, Nov 21:"', "The story text begins at the dateline lead.");
  if (!head) add("RED", "Style", "Headline is empty", "Write the headline.");
  else {
    const hw = words(head).length;
    if (hw < 8 || hw > 14) add("AMBER", "Style", `Headline is ${hw} words; the style sheet asks for about 8 to 14`, "Compare it with your style sheet and decide.");
    if (/\b(says|claims|alleges|is|are)\b/i.test(head)) add("AMBER", "Style", "Headline may use present tense", "The style sheet wants past tense (said, was, had).");
  }
  if (!intro) add("RED", "Style", "Intro is empty", "Write the intro: 1-2 sentences, no dateline, only facts in the story.");
  else {
    if (DATELINE.test(intro)) add("RED", "Style", "Intro starts with a dateline", "The intro has no dateline.");
    if (sentences(intro).length > 2 || words(intro).length > 50) add("AMBER", "Style", "Intro is longer than 1-2 sentences", "Keep it short.");
  }
  const paras = story.split(/\n{2,}/).filter((p) => p.trim());
  if (paras.length < 4 || paras.length > 6) add("AMBER", "Style", `Story has ${paras.length} paragraph(s); the style sheet asks for 4 to 6`, "Check the paragraph breaks.");
  if (paras.some((p) => sentences(p).length > 3)) add("AMBER", "Style", "A paragraph has more than 3 sentences", "Split it.");
  const long = sentences(story).find((s) => words(s).length > 38);
  if (long) add("AMBER", "Style", `Long sentence (over 38 words): "${long.slice(0, 70)}..."`, "Shorten it.");
  if (/₹/.test(all)) add("RED", "Style", 'Rupee symbol found. Write money as "Rs"', "Replace the symbol.");
  if (/\bBilonia\b/i.test(all)) add("RED", "Style", 'Spelling: the town is "Belonia", not "Bilonia"', "Fix the spelling.");
  if (/\bPinakee\b/i.test(all)) add("RED", "Style", 'Spelling: it is "Pinaki Chakraborty", not "Pinakee"', "Fix the spelling.");
  if (/\bMahakaran\b/.test(story) && !/Mahakaran, the Civil Secretariat/.test(story)) add("AMBER", "Style", 'Write "Mahakaran, the Civil Secretariat" on first mention', "");
  if (/\bUnion Home Minister\b/i.test(all)) add("AMBER", "Style", 'Check "Union Home Minister"', "Use \"Home Minister\" as spoken unless the source says Union.");

  const seen = new Set();
  const hitKeys = new Set();
  for (const r of RISK) {
    const m = all.match(r.re);
    if (!m) continue;
    hitKeys.add(r.key);
    const found = [...new Set(m.map((x) => x.toLowerCase()))].slice(0, 6).join(", ");
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    add(r.level, "Legal", `${r.title} (${found})`, `WHY IT MATTERS: ${r.why}\n\nWHAT TO DO: ${r.action}`);
  }
  if (/\b(alleg\w*|accus\w*|criticis\w*|criticiz\w*|blamed|charged|claimed that|attacked|slammed|mislead\w*|confusion)\b/i.test(all)) {
    add("AMBER", "Legal", "Allegation or criticism in the text: right of reply", "Fairness and the Press Council norms ask you to seek the response of the person criticised, or say it could not be obtained.");
  }
  if ([...hitKeys].some((k) => SENSITIVE.has(k))) add("AMBER", "Legal", "Sensitive topic: a second source is needed", "Police, court record, hospital, an official statement or another outlet.");

  const speakers = String(item.speakers || "").trim();
  if (!speakers && /\b(said|told|stated|added)\b/i.test(story)) {
    add("AMBER", "Speaker", "Nobody is recorded as the speaker", "The story quotes someone but no speaker was typed. A speaker is named only when you give the name.");
  }
  if (!item.no_video && String(item.caption_bn || "").trim() && !String(item.gemini_text || "").trim()) {
    add("AMBER", "Source", "Gemini's reply is missing", "Without it the story rests on the caption only.");
  }
  if (item.no_video) add("AMBER", "Source", "No video or audio: the story rests only on your caption", "Make sure names and numbers are verified.");
  else if (String(item.gemini_text || "").trim()) add("AMBER", "Audio", "Gemini's translation is a machine translation", "Listen to the clip and check names, numbers and quotes against it.");

  if (item.photo_url) {
    if (!cap) add("RED", "Photo", "The photo caption is empty", "Write what the picture shows.");
    else if (/\b(took part|inaugurat|addressed|participat|attended)\b/i.test(cap)) add("AMBER", "Photo", "Photo caption claims an action", "Say only what is visible in the picture.");
  } else {
    add("AMBER", "Photo", "No photo: the story goes without a real photograph", "A made-up realistic photo of a news event is never used. The website may add a drawn, labelled illustration only if its image key is set, and never for sensitive stories.");
  }
  return finish(rows);
}

function finish(rows) {
  const red = rows.filter((r) => r.level === "RED").length;
  return { red, amber: rows.length - red, rows: [...rows.filter((r) => r.level === "RED"), ...rows.filter((r) => r.level !== "RED")] };
}
