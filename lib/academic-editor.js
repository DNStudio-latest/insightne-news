// "Edit like an academic editor": the AI revises a passage of the owner's PhD thesis (journalism and mass
// communication, social sciences) for clarity and the writer's own voice, without adding any fact, source or
// citation. Used by the thesis checker in the admin panel (app/admin/thesis-check). The rules come from the
// research summarised in docs/10-THESIS-AI-TOOLS.md.
//
// Claude is used when the site has ANTHROPIC_API_KEY or OPENROUTER_API_KEY (model: CLAUDE_ACADEMIC_MODEL, then
// CLAUDE_EDITOR_MODEL), otherwise Gemini (GEMINI_ACADEMIC_MODEL, GEMINI_EDITOR_MODEL).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseJsonReply, usingOpenRouter } from "./ai.js";
import { createGeminiCaller } from "./gemini.js";
import { newNumbers } from "./news-editor.js";
import { applySafeReplacements } from "../public/ai-tools/engine.js";
import { findCitations, findQuotes, protectedRanges, EXCESS_WORDS } from "../public/ai-tools/academic.js";

export const MAX_INPUT_CHARS = 12000;
export const MODES = { light: "Light: language only", thorough: "Thorough: language and sentence structure" };

// The words that rose most after ChatGPT (Kobak et al. 2025), for the instructions.
const TOP_EXCESS = Object.keys(EXCESS_WORDS).slice(0, 60).join(", ");

export const ACADEMIC_SYSTEM = `You are a senior academic editor with long experience of editing PhD theses in journalism, mass
communication and the social sciences for Indian and international universities. The writer is a doctoral
researcher in journalism and mass communication. They have written the passage below themselves and want it to
read as clear, precise scholarly English in their own voice. You edit; you never write new content.

THE ONE RULE ABOVE ALL: never add anything. Do not add or change any fact, finding, figure, percentage, date, name,
place, organisation, newspaper, quotation, source, citation, reference, theory, author or claim. Never invent a
citation or a reference, and never complete one. If the passage needs a source, evidence, an example or a figure
it does not have, do not supply it: put it in "notes" as a question for the writer.

KEEP EXACTLY AS WRITTEN
- Every citation, character for character and in the same place: (Author, 2019), (Author et al., 2019, p. 23),
  Author (2019), [12], footnote numbers. Do not reformat, merge, move or drop them.
- Every direct quotation, in double or single quotation marks, word for word, with its punctuation; this includes
  interview responses, survey answers and quoted newspaper text.
- Every number, statistic, table or figure reference, and every technical term or concept the writer uses
  (for example agenda-setting, framing, gatekeeping, public sphere, development communication, hegemony,
  mixed-methods, purposive sampling). Do not swap a term for a synonym.
- The writer's position. Never make a claim stronger or weaker than the writer made it: keep "may", "suggests",
  "appears", "is likely" where they are; do not turn "suggests" into "shows" or "shows" into "suggests". If a
  claim looks overstated (for example "proves", "undoubtedly"), keep it and say so in "notes".
- The writer's person and stance: if they write "I", "we" or "the researcher", keep that; do not switch between them.
- The paragraphs: the same number of paragraphs, in the same order, separated by a blank line.
- The spelling convention of the passage (Indian/British "-ise", "programme", "behaviour" unless the writer uses
  American spelling throughout).

EDIT
- Plain, precise words. Cut words that do no work. Prefer the active voice where the actor matters ("Editors
  selected…" rather than "It was selected by editors…"); keep the passive in method descriptions where it is normal.
- Replace the stock vocabulary of machine-written academic prose with the plain word the writer means. These
  words rose sharply in research writing after ChatGPT (Kobak et al. 2025): ${TOP_EXCESS}. Also: "plays a crucial
  role", "a nuanced understanding of", "provides valuable insights", "highlights the importance of", "the intricate
  interplay between", "serves as a testament to", "navigating the complexities", "in the realm of", "a wide array
  of", "paves the way", "sheds light on", "not only … but also", "it is not just X, it is Y".
- No trailing "-ing" clauses that add an interpretation after a comma (", highlighting…", ", reflecting…",
  ", underscoring…", ", thereby…"). Make the interpretation its own sentence, or leave it out if the passage does
  not support it (and say so in "notes").
- Do not open sentences with "Moreover", "Furthermore", "Additionally" or "Notably" unless the link is needed; do not
  add signposting, summaries, transitions or rhetorical questions. Do not end a paragraph with a generic summary
  sentence; if the writer's own paragraph ends with one, keep it but tighten it.
- Vary sentence length the way a careful human writer does: a long sentence that develops an idea, then a short
  one that makes the point. Split sentences over about 40 words.
- Keep the register academic but not inflated. Do not make the text sound more "academic", more impressive or more
  formal than the writer's own; aim for the plainest version of what they said.
- Tense: past tense for what was done and found in this study and for completed past studies; present tense for
  what the literature generally holds and what a table or chapter shows. Keep the writer's choice where it is
  consistent.
- Indian English is correct English: do not "correct" established Indian usage (lakh, crore, district magistrate)
  unless it is an error.

MODE: {MODE}

NOTES (report every problem; do not fix by inventing)
- Claims about the literature without a citation ("Many scholars argue…", "Studies have shown…").
- Claims that need evidence, an example or a figure the passage does not give.
- Overstatements and sweeping generalisations; inconsistent terms, names or figures within the passage.
- Sentences that still read as generic or machine-written because they say nothing specific: suggest what kind
  of detail from the writer's own data or reading would make them specific (do not supply it).
- Research ethics: identifiable interview respondents or minors, confidential sources, caste or community details
  that may need anonymising or justifying.

Reply with JSON only:
- "edited": the edited passage, paragraphs separated by a blank line.
- "notes": the problems found, as short questions or checks for the writer. An empty list only if there are none.
- "changes": up to ten short descriptions of the main edits, each naming the words changed
  (for example: "'plays a pivotal role in shaping' -> 'shapes'").`;

const MODE_TEXT = {
  light: "LIGHT. Change only words and phrases: grammar, wordiness, stock phrasing and the vocabulary above. Keep every sentence's structure and order.",
  thorough: "THOROUGH. Also restructure sentences for clarity and rhythm: split, combine within a paragraph, reorder clauses, convert to the active voice. Keep every paragraph's points in the same order.",
};

export const systemFor = (mode = "light") => ACADEMIC_SYSTEM.replace("{MODE}", MODE_TEXT[mode] || MODE_TEXT.light);

export const AcademicResult = z.object({
  edited: z.string().min(1),
  notes: z.array(z.string()).default([]),
  changes: z.array(z.string()).default([]),
});

export function academicProvider(env = process.env) {
  if (env.ANTHROPIC_API_KEY || env.OPENROUTER_API_KEY) return "claude";
  if (env.GEMINI_API_KEY) return "gemini";
  return null;
}

function defaultGenerate(provider) {
  if (provider === "gemini") {
    const call = createGeminiCaller({ model: process.env.GEMINI_ACADEMIC_MODEL || process.env.GEMINI_EDITOR_MODEL || undefined, maxOutputTokens: 8000, gapMs: 0, temperature: 0.2 });
    return (system, text) => call(system, text);
  }
  const client = usingOpenRouter
    ? new Anthropic({ baseURL: "https://openrouter.ai/api", apiKey: null, authToken: process.env.OPENROUTER_API_KEY })
    : new Anthropic();
  const model = process.env.CLAUDE_ACADEMIC_MODEL || process.env.CLAUDE_EDITOR_MODEL || process.env.CLAUDE_MODEL || (usingOpenRouter ? "anthropic/claude-haiku-5.5" : "claude-haiku-5-5");
  return async (system, text) => {
    const response = await client.messages.create({
      model,
      max_tokens: 8000,
      system: `${system}\n\nReply with only one JSON object that matches this JSON schema, and nothing else:\n${JSON.stringify(z.toJSONSchema(AcademicResult))}`,
      messages: [{ role: "user", content: text }],
    });
    if (response.stop_reason === "refusal") throw new Error("The AI declined to edit this text");
    if (response.stop_reason === "max_tokens") throw new Error("The edited text was too long and was cut off. Edit a shorter passage.");
    return response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  };
}

// The checker's automatic corrections ("in order to" -> "to"), outside quotations and citations only.
export function safeOutsideProtected(text) {
  const s = String(text || "");
  let out = "";
  let at = 0;
  for (const [a, b] of protectedRanges(s)) {
    if (a < at) continue;
    out += applySafeReplacements(s.slice(at, a)).text + s.slice(a, b);
    at = b;
  }
  return out + applySafeReplacements(s.slice(at)).text;
}

const squash = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();
const paragraphCount = (s) => String(s).split(/\n\s*\n/).filter((p) => p.trim()).length;

// Safety nets for the one rule. Returns notes about citations, quotations, figures and paragraphs that differ.
export function integrityNotes(original, edited) {
  const notes = [];
  const count = (list) => list.reduce((m, x) => m.set(squash(x), (m.get(squash(x)) || 0) + 1), new Map());
  const before = count(findCitations(original).map((c) => c.text));
  const after = count(findCitations(edited).map((c) => c.text));
  const lost = [...before].filter(([c, n]) => (after.get(c) || 0) < n).map(([c]) => c);
  const added = [...after].filter(([c, n]) => (before.get(c) || 0) < n).map(([c]) => c);
  if (lost.length) notes.push(`Check these citations: they are in your text but not in the edit: ${lost.join("; ")}.`);
  if (added.length) notes.push(`Check these citations: they are in the edit but not in your text: ${added.join("; ")}.`);
  const editedFlat = squash(edited);
  const changedQuotes = findQuotes(original).map((q) => q.text).filter((q) => !editedFlat.includes(squash(q)));
  if (changedQuotes.length) notes.push(`These quotations were changed or dropped in the edit; restore them word for word: ${changedQuotes.map((q) => (q.length > 80 ? `${q.slice(0, 77)}…` : q)).join(" | ")}`);
  const figures = newNumbers(original, edited);
  if (figures.length) notes.push(`Check these figures: they are in the edit but not in your text: ${figures.join(", ")}.`);
  const pb = paragraphCount(original);
  const pa = paragraphCount(edited);
  if (pb !== pa) notes.push(`Your text has ${pb} paragraph${pb === 1 ? "" : "s"} and the edit has ${pa}. Check that nothing was merged, split or lost.`);
  return notes;
}

// Returns { edited, notes, changes, provider } or throws an Error with a message for the writer.
export async function editLikeAcademicEditor(text, { mode = "light", generate, provider = academicProvider() } = {}) {
  const passage = String(text || "").trim();
  if (!passage) throw new Error("Paste a passage first.");
  if (passage.length > MAX_INPUT_CHARS) throw new Error(`The passage is too long for one edit (${passage.length.toLocaleString("en")} characters; the limit is ${MAX_INPUT_CHARS.toLocaleString("en")}). Edit it a few paragraphs at a time.`);
  if (!provider && !generate) throw new Error("No AI key is set for the website (ANTHROPIC_API_KEY, OPENROUTER_API_KEY or GEMINI_API_KEY).");
  const ask = generate || defaultGenerate(provider);
  let out;
  try {
    out = parseJsonReply(await ask(systemFor(mode), `Edit this passage from my thesis:\n\n"""\n${passage}\n"""`), AcademicResult);
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof z.ZodError) throw new Error("The AI's answer was not in the expected format. Please try again.");
    throw err;
  }
  const edited = safeOutsideProtected(out.edited.trim());
  const leftover = [...new Set((edited.match(/\p{L}+/gu) || []).filter((w) => EXCESS_WORDS[w.toLowerCase()] >= 3 && !findQuotes(edited).some((q) => q.text.includes(w))))];
  const notes = [...integrityNotes(passage, edited), ...out.notes];
  if (leftover.length) notes.push(`The edit still uses words that rose sharply with ChatGPT: ${leftover.join(", ")}. Keep them only if they are the exact words you mean.`);
  return { edited, notes, changes: out.changes, provider: provider || "custom", mode: MODE_TEXT[mode] ? mode : "light" };
}
