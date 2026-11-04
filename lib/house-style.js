// The senior news editor's writing rules (attribution, plain words, crime and fairness), shared by every AI tool
// that writes for the website: the senior editor (lib/news-editor.js), the daily summaries (lib/ai.js,
// lib/gemini.js) and the Research desk and News Hunter drafts (lib/hunter/ai.js). Change the rules here and
// every tool follows them. House rules set by the owner are listed in CLAUDE.md; keep them when editing.
// After each AI answer, applyHouseStyle() also makes the safe, mechanical corrections of the AI checker.
import { applySafeReplacements } from "../public/ai-tools/engine.js";

export const WRITING_RULES = `6. ATTRIBUTION
- Attribute every claim, allegation, opinion and figure to its source, as the report gives it.
- Use "said". Replace "stated", "noted", "commented", "informed", "opined", "added further" and "claimed"
  with "said" ("claimed" only when the report itself shows the assertion is disputed).
- Name the source if the report names it: "according to the FIR", "police said". If the report gives no source
  for an account of events, keep "allegedly" and ask for the source in "notes".

7. PLAIN WORDS
- Prefer the short, everyday word; cut every word that does no work; use the active voice.
- Do not write "occurred". Build the sentence around who did what, when and where:
  "The incident occurred when X questioned the fee" -> "X questioned the fee". For planned events use
  "was held" or "took place" ("The meeting was held on Monday"); for incidents, "happened" if a verb of that
  kind is truly needed.
- Cut empty phrases: "it is learnt that", "in this regard", "the said", "on the occasion", "further",
  "it may be mentioned that", "in a major boost", "rushed to the spot", "a pall of gloom", "left no stone unturned".
- No judgement words (good, bad, shocking, horrendous, brutal, heinous) unless quoted and attributed; let the
  facts speak. Prefer positive statements ("The plan failed", not "The plan was not successful").
- Use first, last, largest, unique, record or unprecedented only if the report shows it.
- None of the stock phrases of machine-written text: "delve", "crucial role", "landscape", "moreover",
  "furthermore", "in conclusion", "it is important to note", "testament to", "navigate", "foster".
- No trailing "-ing" result clauses after a comma: ", prompting…", ", leading to…", ", resulting in…",
  ", sparking…", ", triggering…", ", causing…", ", highlighting…", ", underscoring…", ", signalling…",
  ", marking…", ", raising concerns…", ", fuelling…", ", reflecting…". They are a hallmark of machine-written
  prose, they chain two events into one long sentence, and they claim a cause the source may not have stated.
  Split them: one event per sentence, in time order, with "then", "after" or "when" only where the report
  supports the sequence. If the report states a cause, attribute it ("…, she said").
  Example (from a real edit): "…she began recording the altercation on her mobile phone, prompting the female
  staffer to allegedly push both women…" -> "Bhattacharjee said she began recording the altercation on her phone
  while co-workers tried to calm the staffer down. The staffer then allegedly pushed both women, grabbed
  Bhattacharjee by the hair and dragged her to the ground, she said." (Example only; never copy its facts.)
- People: name first, then a lower-case description on first reference ("Nilanjana Bhattacharjee, a deputy
  magistrate posted in Belonia" — use the names and posts in the report, never these examples); a title is
  capitalised only directly before a name. Surname afterwards.
- Spell out an abbreviation on first use; use the short form after only if it appears again.
- Indian English spelling (organise, programme, labour). One to nine in words, 10 and above in figures;
  "per cent"; "Rs 20"; lakh and crore as in the report; times as "5.24 am"; days as "on Wednesday".

8. CRIME, COURTS AND FAIRNESS (Press Council of India norms)
- Allegations stay allegations ("allegedly", "accused of", "according to police"). Never present them as fact,
  and never pronounce guilt: no "parallel trial".
- Never name or identify a victim of rape, abduction or child sexual assault; if the report does, remove the
  identifying details and say so in "notes".
- Do not name innocent relatives or associates of an accused person unless they are relevant.
- Mention caste or community only if it is relevant to the offence; otherwise remove it and say so in "notes".
- Do not comment on or evaluate a confession the accused allegedly made.`;

// The rules as a block for the other AI tools. Their own rules on facts, quotes and format come first.
export const HOUSE_STYLE = `

HOUSE STYLE (the InsightNE senior news editor's rules for all writing on the website)
Follow these in every sentence you write. They never override the rules above on facts and format: use only
facts from the sources, never add a fact, and never change any word inside direct quotation marks.
In these rules, "the report" means your sources. Where a rule says to put a point in "notes", put it where your
instructions above say problems go (for example "[CHECK]" or "check_reasons"); if there is no such place, leave
the point out rather than guess.

${WRITING_RULES}`;

// Spans inside quotation marks ("…" or “…”), which are never changed: quotes must stay word for word.
const QUOTE_RE = /“[^”]*”|"[^"\n]*"/g;

// The AI checker's automatic corrections ("in order to" -> "to", "prior to" -> "before"; see SAFE_REPLACEMENTS in
// public/ai-tools/engine.js), made outside quotations only. Returns { text, changes: [{ from, to }] }.
export function applyHouseStyle(text) {
  const s = String(text ?? "");
  const changes = [];
  let out = "";
  let at = 0;
  const fix = (part) => {
    const r = applySafeReplacements(part);
    changes.push(...r.changes.map(({ from, to }) => ({ from, to })));
    return r.text;
  };
  for (const m of s.matchAll(QUOTE_RE)) {
    out += fix(s.slice(at, m.index)) + m[0];
    at = m.index + m[0].length;
  }
  out += fix(s.slice(at));
  return { text: out, changes };
}

export const houseText = (text) => applyHouseStyle(text).text;
