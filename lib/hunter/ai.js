// The News Hunter's AI (Gemini, free tier): decides which items are news, and writes full drafts.
import { z } from "zod";
import { parseJsonReply, pickRegion } from "../ai.js";

const READERS =
  "InsightNE News is a news website for readers across the eight states of Northeast India " +
  "(Tripura, Assam, Meghalaya, Manipur, Mizoram, Nagaland, Arunachal Pradesh, Sikkim). It is based in Tripura.";

const Judgement = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      newsworthy: z.boolean(),
      score: z.number().int().min(1).max(10),
      routine: z.boolean(),
      state: z.string(),
      language: z.enum(["en", "bn", "kok", "lus", "hi", "other"]),
      event: z.string(),
      same_as: z.string().nullable(),
      reason: z.string(),
    }),
  ),
});

const JUDGE_SYSTEM = `You are a senior news editor. ${READERS}
You get NEW items found today on official government websites and official YouTube channels: press releases,
notifications, orders, circulars, speeches and videos. Decide for each one if it is news worth a full report.

NEWSWORTHY (score 7-10): decisions, new schemes, policy changes, cabinet decisions, budgets, public health or
safety notices, exam or school announcements affecting many people, disasters and relief, law and order notices,
large recruitment drives, visits, meetings, inaugurations and announcements by a Governor, Chief Minister or Minister.
ROUTINE (newsworthy=false, routine=true, score 1-4): tenders, quotations, corrigenda, expressions of interest,
transfers and postings of junior staff, leave orders, office timings, meeting minutes, forms, holiday lists,
greetings, birthday wishes, simple photo captions. EXCEPTION: a routine item is news if it is unusual or important
(for example a very large tender for a major project, or the transfer of a Chief Secretary or police chief).
Score 5-6 = minor but publishable.

For each item also give:
- state: the Northeast state it is about (one of the STATES list), or "Northeast" if several.
- language: the main language of the text: "en" English, "bn" Bengali, "kok" Kokborok, "lus" Mizo, "hi" Hindi, or "other".
- event: one short English sentence saying who did what (for finding duplicates).
- same_as: if this item reports the same event as another NEW item, that item's id; or if it is the same event as one
  of the RECENT DRAFTS, that draft's id. Otherwise null.
- reason: a few words explaining your decision.
Judge only from the text given. Never invent facts.`;

const Draft = z.object({
  headline: z.string(),
  paragraphs: z.array(z.string()).min(2).max(7),
  attribution: z.string(),
  state: z.string(),
  topic: z.string().nullable(),
});

const DRAFT_SYSTEM = `You are a reporter for InsightNE News. ${READERS}
Write a full news report from the SOURCE DOCUMENTS below (official press releases, notifications, speeches or video
descriptions). Rules, all of them strict:

FACTS
- Use ONLY facts written in the source documents. Never add facts, background, numbers, names, dates or reasons
  that are not in them. Do not guess. If something is unclear, missing or contradictory, write it carefully and
  put [CHECK] right after it.
- Keep names, designations, places, numbers, amounts and dates exactly as in the source.

QUOTES
- Quote people only with words copied character for character from the source, inside double quotation marks.
  Never change, shorten inside, fix or translate words within quotation marks.
- If the quote is not in English, copy it in its original language and script inside the quotation marks, then
  give an English translation in brackets, starting with "translated:".
- Every quote must say who said it.

STYLE
- Simple, clear English in a professional news style. Short sentences. No opinions, no praise, no adjectives like
  "historic" or "landmark" unless they are inside a quote.
- Do not copy sentences from the sources: rewrite in your own words (quotes are the only exception).
- headline: clear and factual, at most 15 words.
- paragraphs: first a strong opening paragraph that says who, what, when, where and why (only the parts the source
  gives). Then 3 to 5 short paragraphs with the details, most important first.
- attribution: one sentence naming the source, for example "This is according to a notification issued by the
  Education Department of Tripura on October 28, 2026." or "according to a press release from Lok Bhavan, Shillong".
  Also attribute facts inside the paragraphs ("the notification said", "according to the press release").
- state: the Northeast state the news is about (one of STATES), or "Northeast".
- topic: one of TOPICS, or null.`;

export function createHunterAi({ generate, states, topics, log = console.log }) {
  return {
    // items: [{ id, source, kind, title, text }]; recent: [{ id, event }]. Returns a Map id → judgement.
    async judge(items, recent = []) {
      const system = `${JUDGE_SYSTEM}\nSTATES: ${JSON.stringify(states)}\n\nReply with only one JSON object that matches this JSON schema:\n${JSON.stringify(z.toJSONSchema(Judgement))}`;
      const content = `RECENT DRAFTS:\n${JSON.stringify(recent)}\n\nNEW ITEMS:\n${JSON.stringify(
        items.map((i) => ({ id: i.id, source: i.source, kind: i.kind, title: i.title, text: i.text.slice(0, 2500) })),
        null,
        1,
      )}`;
      const out = parseJsonReply(await generate(system, content), Judgement);
      return new Map(out.items.map((j) => [j.id, { ...j, state: pickRegion(j.state, states) }]));
    },

    // documents: [{ source, kind, title, url, published, text }]. Returns { headline, paragraphs, attribution, state, topic }.
    async draft(documents) {
      const system = `${DRAFT_SYSTEM}\nSTATES: ${JSON.stringify(states)}\nTOPICS: ${JSON.stringify(topics)}\n\nReply with only one JSON object that matches this JSON schema:\n${JSON.stringify(z.toJSONSchema(Draft))}`;
      const content = `SOURCE DOCUMENTS:\n${JSON.stringify(
        documents.map((d) => ({ source: d.source, kind: d.kind, title: d.title, published: d.published, text: d.text.slice(0, 9000) })),
        null,
        1,
      )}`;
      const out = parseJsonReply(await generate(system, content), Draft);
      return { ...out, state: pickRegion(out.state, states), topic: topics.includes(out.topic) ? out.topic : null };
    },
  };
}
