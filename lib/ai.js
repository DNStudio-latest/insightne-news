// Everything that talks to Claude (the AI) lives here.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

// Claude Haiku is the lowest-cost Claude model. You can change it with the CLAUDE_MODEL setting.
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-5-5";

const READERS =
  "InsightNE News is a news website for readers in Tripura and the rest of Northeast India " +
  "(Assam, Meghalaya, Manipur, Mizoram, Nagaland, Arunachal Pradesh, Sikkim).";

const SCORE_SYSTEM = `You are a senior news editor. ${READERS}
Score each article from 1 to 10 for how important it is for these readers.
- 9-10: major events that directly affect many people in Tripura: big government decisions, disasters, safety alerts, major policy.
- 7-8: significant Tripura news, or major news for the wider Northeast.
- 6: useful regional news that is worth publishing.
- 3-5: minor local items, routine press releases, small events, or national/world news with only a weak Northeast link.
- 1-2: not about the Northeast, celebrity gossip, film/OTT releases, horoscopes, adverts, sponsored content.
Give Tripura stories a small boost. Judge only from the headline and snippet given. Some articles are in Bengali; score them the same way.`;

const GROUP_SYSTEM = `You are a news editor removing duplicates. ${READERS}
You get NEW articles (ids starting with "a") and EXISTING stories already on file (ids that are long codes).
Put new articles that report the same event or development into one group. Different events stay in different groups, even if the topic is similar.
If a group reports the same event as an existing story, set existing_story_id to that story's id; otherwise null.
Every new article id must appear in exactly one group.`;

const SUMMARY_SYSTEM = `You write short news summaries for InsightNE News. ${READERS}
You get one news event as reported by one or more sources (headline and short snippet each). Write:
- headline: a clear, neutral headline in your own words, at most 14 words. No clickbait, no exclamation marks. Do not copy the source headline word for word.
- summary: 2 or 3 sentences, at most 70 words, in your own words. Never copy a phrase of more than five words from the sources. Use only facts found in the sources; never add facts. When something is a claim or allegation, say who made it ("police said", "according to ...").
- region: "Tripura" if the event is mainly about Tripura, otherwise "Northeast".
- topic: one of TOPICS if it clearly fits, otherwise null.
- needs_extra_check: true if the story seems unverified, is based on rumour or a single unnamed claim, is sensational, or is sensitive: violence, religion, communities or ethnic groups, elections, accidents, or crime involving named people.
- check_reasons: short reasons for needs_extra_check (empty list if false).
Always write in English, even when a source is in Bengali.`;

const ScoreResult = z.object({
  scores: z.array(z.object({ id: z.string(), score: z.number().int() })),
});

const GroupResult = z.object({
  groups: z.array(z.object({ article_ids: z.array(z.string()), existing_story_id: z.string().nullable() })),
});

const SummaryResult = z.object({
  headline: z.string(),
  summary: z.string(),
  region: z.string(),
  topic: z.string().nullable(),
  needs_extra_check: z.boolean(),
  check_reasons: z.array(z.string()),
});

export function createClaudeAi({ client = new Anthropic(), topics = [] } = {}) {
  async function ask(system, content, schema, maxTokens = 8000) {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: maxTokens,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      system,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") throw new Error("Claude declined this request");
    if (response.stop_reason === "max_tokens") throw new Error("Claude's answer was cut off (too long)");
    if (!response.parsed_output) throw new Error("Claude's answer was not in the expected format");
    return response.parsed_output;
  }

  return {
    model: MODEL,

    // articles: [{ id, sourceName, title, snippet }] -> Map(id -> score)
    async score(articles) {
      const list = articles.map((a) => ({ id: a.id, source: a.sourceName, headline: a.title, snippet: a.snippet }));
      const out = await ask(SCORE_SYSTEM, `Score these articles:\n${JSON.stringify(list, null, 1)}`, ScoreResult);
      return new Map(out.scores.map((s) => [s.id, Math.max(1, Math.min(10, s.score))]));
    },

    // Returns [{ articleIds: [...], existingStoryId }]
    async group(articles, existingStories) {
      const list = articles.map((a) => ({ id: a.id, source: a.sourceName, headline: a.title }));
      const existing = existingStories.map((s) => ({ id: s.id, headline: s.headline }));
      const out = await ask(
        GROUP_SYSTEM,
        `NEW articles:\n${JSON.stringify(list, null, 1)}\n\nEXISTING stories:\n${JSON.stringify(existing, null, 1)}`,
        GroupResult,
      );
      return out.groups.map((g) => ({ articleIds: g.article_ids, existingStoryId: g.existing_story_id }));
    },

    // articles: the reports of one event. extraInstruction is used when we ask again.
    async summarize(articles, extraInstruction = "") {
      const list = articles.map((a) => ({ source: a.sourceName, headline: a.title, snippet: a.snippet }));
      const out = await ask(
        `${SUMMARY_SYSTEM}\nTOPICS: ${JSON.stringify(topics)}`,
        `${extraInstruction}Sources:\n${JSON.stringify(list, null, 1)}`,
        SummaryResult,
        4000,
      );
      return {
        headline: out.headline.trim(),
        summary: out.summary.trim(),
        region: out.region === "Tripura" ? "Tripura" : "Northeast",
        topic: topics.includes(out.topic) ? out.topic : null,
        needsCheck: out.needs_extra_check,
        checkReasons: out.check_reasons,
      };
    },
  };
}

// Practice mode: a stand-in that costs nothing, used only on your own computer
// when no Claude API key is set. Its "summaries" are placeholders, not real writing.
export function createPracticeAi() {
  const NE = /\b(assam|meghalaya|manipur|mizoram|nagaland|arunachal|sikkim|northeast|north-east|guwahati|shillong|imphal|aizawl|kohima|itanagar)\b/i;
  return {
    model: "practice-mode (no AI)",
    async score(articles) {
      return new Map(
        articles.map((a) => {
          const text = `${a.title} ${a.snippet}`;
          return [a.id, /tripura|agartala|ত্রিপুরা|আগরতলা/i.test(text) ? 8 : NE.test(text) ? 6 : 3];
        }),
      );
    },
    async group(articles) {
      return articles.map((a) => ({ articleIds: [a.id], existingStoryId: null }));
    },
    async summarize(articles) {
      const first = articles[0];
      return {
        headline: `[Practice] ${first.title}`,
        summary: "Practice mode: this is a placeholder. Claude writes the real 2–3 sentence summary once your Claude API key is added.",
        region: /tripura|agartala/i.test(first.title) ? "Tripura" : "Northeast",
        topic: null,
        needsCheck: false,
        checkReasons: [],
      };
    },
  };
}
