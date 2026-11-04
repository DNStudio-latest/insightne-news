// "Edit like a senior news editor": the AI rewrites a report to international wire-service standards
// (the house style of agencies such as Reuters, AFP, AP and PTI) without adding any fact.
// Used by the AI checker in the admin panel (app/admin/ai-check). Claude is used when the site has a Claude
// key (ANTHROPIC_API_KEY or OPENROUTER_API_KEY), otherwise Gemini (GEMINI_API_KEY).
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseJsonReply, usingOpenRouter } from "./ai.js";
import { createGeminiCaller } from "./gemini.js";

export const MAX_INPUT_CHARS = 12000;

export const EDITOR_SYSTEM = `You are the senior desk editor of an international news agency, with decades of experience
at wire services such as Reuters, AFP, AP and PTI. You edit copy for InsightNE News, a news website for
Tripura and Northeast India. A reporter has sent you a report. Edit it to wire-service standard.

THE ONE RULE ABOVE ALL: never add a fact. Do not add or change any name, designation, number, date, time,
place, quote, source or claim that is not in the reporter's text. Do not guess missing details. If the report
needs something it does not have (who said it, when, where, how many, a second source, the other side's
response), do not invent it: put it in "notes" as a question for the reporter.

Structure
- Inverted pyramid: the most important new fact first; background and context last.
- Lead: one sentence, ideally under 35 words, saying who did what, where and when (and why, if the text says).
  No questions, quotes or scene-setting as the lead.
- Short paragraphs of one or two sentences, separated by a blank line.
- Second paragraph: the next most important fact, or the source of the news.
- Cut repetition, padding, background the reader does not need, and anything the text does not support.

Attribution and fairness
- Attribute every claim, allegation, opinion, number and accusation to its source, as the text gives it.
  Use "said" (not "stated", "claimed", "noted", "opined", "informed", "added further").
- Allegations stay allegations: "alleged", "accused", "according to police". Never present them as fact.
- If only one side of a dispute is in the text, keep it, and ask in "notes" whether the other side was contacted.
- Keep direct quotes exactly as written. You may shorten a quote only by ending it earlier or by paraphrasing
  it as indirect speech with attribution.

Style
- Plain, neutral, factual English. No opinion, no hype, no adjectives of praise or blame, no clichés
  ("in a major boost", "rushed to the spot", "a pall of gloom", "left no stone unturned"), no rhetorical questions.
- None of the stock phrases of machine-written text: "delve", "crucial role", "landscape", "moreover",
  "furthermore", "in conclusion", "it is important to note", "testament to", "navigate", "foster".
- Active voice where the actor is known. Vary sentence length naturally; prefer short sentences.
- Full name and designation on first reference, surname (or designation) afterwards, exactly as the text gives them.
- Indian English spelling (organise, programme, labour). Numbers: one to nine in words, 10 and above in figures;
  "per cent"; lakh and crore as in the text. Dates as "on Tuesday" or "on 4 November", as the text allows.
- Keep local names, places and official titles of Tripura and the Northeast exactly as in the text.
- Headline: sentence case, 8 to 14 words, a present-tense verb, specific, no full stop, nothing the body does not say.

Reply with JSON only:
- "headline": the edited headline.
- "body": the edited report, paragraphs separated by a blank line. No headline, dateline or byline inside it.
- "notes": questions and checks for the reporter (missing facts, unattributed claims, possible legal or
  fairness problems). An empty list if there are none.
- "changes": up to six short descriptions of the main edits you made.`;

export const EditResult = z.object({
  headline: z.string().min(1),
  body: z.string().min(1),
  notes: z.array(z.string()),
  changes: z.array(z.string()),
});

// Which AI the editor will use, from the site's settings.
export function editorProvider(env = process.env) {
  if (env.ANTHROPIC_API_KEY || env.OPENROUTER_API_KEY) return "claude";
  if (env.GEMINI_API_KEY) return "gemini";
  return null;
}

// A function (system, userText) -> raw reply text, for the configured AI.
function defaultGenerate(provider) {
  if (provider === "gemini") {
    const call = createGeminiCaller({ model: process.env.GEMINI_EDITOR_MODEL || undefined, maxOutputTokens: 6000, gapMs: 0 });
    return (system, text) => call(system, text);
  }
  const client = usingOpenRouter
    ? new Anthropic({ baseURL: "https://openrouter.ai/api", apiKey: null, authToken: process.env.OPENROUTER_API_KEY })
    : new Anthropic();
  // The editor can use a stronger model than the cheap one used for daily summaries.
  const model = process.env.CLAUDE_EDITOR_MODEL || process.env.CLAUDE_MODEL || (usingOpenRouter ? "anthropic/claude-haiku-5.5" : "claude-haiku-5-5");
  return async (system, text) => {
    const response = await client.messages.create({
      model,
      max_tokens: 6000,
      system: `${system}\n\nReply with only one JSON object that matches this JSON schema, and nothing else:\n${JSON.stringify(z.toJSONSchema(EditResult))}`,
      messages: [{ role: "user", content: text }],
    });
    if (response.stop_reason === "refusal") throw new Error("The AI declined to edit this text");
    if (response.stop_reason === "max_tokens") throw new Error("The edited text was too long and was cut off");
    return response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  };
}

// Words that are numbers in the original or the edit (digits, with commas or decimals).
const numbersIn = (text) => new Set((String(text).match(/\d[\d,.]*\d|\d/g) || []).map((n) => n.replace(/,/g, "").replace(/\.$/, "")));

// A safety net for the one rule: figures in the edit that are not in the original are listed for checking.
export function newNumbers(original, edited) {
  const before = numbersIn(original);
  return [...numbersIn(edited)].filter((n) => !before.has(n));
}

// Returns { headline, body, notes, changes, provider } or throws an Error with a message for the editor.
export async function editLikeSeniorEditor(text, { generate, provider = editorProvider() } = {}) {
  const report = String(text || "").trim();
  if (!report) throw new Error("Paste a report first.");
  if (report.length > MAX_INPUT_CHARS) throw new Error(`The text is too long for one edit (${report.length.toLocaleString("en")} characters; the limit is ${MAX_INPUT_CHARS.toLocaleString("en")}). Edit it in parts.`);
  if (!provider && !generate) throw new Error("No AI key is set for the website (ANTHROPIC_API_KEY, OPENROUTER_API_KEY or GEMINI_API_KEY).");
  const ask = generate || defaultGenerate(provider);
  let out;
  try {
    out = parseJsonReply(await ask(EDITOR_SYSTEM, `Edit this report:\n\n"""\n${report}\n"""`), EditResult);
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof z.ZodError) throw new Error("The AI's answer was not in the expected format. Please try again.");
    throw err;
  }
  const notes = [...out.notes];
  const added = newNumbers(report, `${out.headline}\n${out.body}`);
  if (added.length) notes.unshift(`Check these figures: they are in the edit but not in the original: ${added.join(", ")}.`);
  return { headline: out.headline.trim(), body: out.body.trim(), notes, changes: out.changes, provider: provider || "custom" };
}
