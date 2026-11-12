// Free summaries with Google Gemini (free tier, needs only a GEMINI_API_KEY from aistudio.google.com).
// Gemini writes the headline and summary. Scoring and grouping stay with the free rules, so a run
// uses one Gemini request per new story and stays inside the free daily limit.
import { z } from "zod";
import { SUMMARY_SYSTEM, SummaryResult, parseJsonReply, pickRegion } from "./ai.js";
import { houseText } from "./house-style.js";

// "-latest" names always point at Google's current Flash-Lite model, so the site keeps working when
// Google retires an old version. You can pick another model with the GEMINI_MODEL setting.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const API = "https://generativelanguage.googleapis.com/v1beta/models";

// The free tier allows only a few requests a minute, so requests go one at a time with a gap.
const GAP_MS = Number(process.env.GEMINI_GAP_MS ?? 4500);
const RETRIES = 3;
const TIMEOUT_MS = 120000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sends one request to Gemini and returns its text answer. `content` is plain text, or a list of parts
// (text and files, e.g. a PDF). Requests wait their turn so the free limit is not exceeded.
// `json: false` asks for plain text instead of JSON, and `temperature` sets how varied the answers are
// (the news summaries keep the defaults: JSON at 0.3).
export function createGeminiCaller({ apiKey = process.env.GEMINI_API_KEY, fetchFn = fetch, gapMs = GAP_MS, model = MODEL, maxOutputTokens = 2000, json = true, temperature = 0.3 } = {}) {
  let queue = Promise.resolve();
  let lastCall = 0;

  // Runs requests one after another, at least gapMs apart.
  function inTurn(fn) {
    const next = queue.then(async () => {
      const wait = lastCall + gapMs - Date.now();
      if (wait > 0) await sleep(wait);
      try {
        return await fn();
      } finally {
        lastCall = Date.now();
      }
    });
    queue = next.catch(() => {});
    return next;
  }

  return async function generate(system, content) {
    const parts = typeof content === "string" ? [{ text: content }] : content;
    for (let attempt = 0; ; attempt++) {
      // A request that gets no answer in 2 minutes is given up (Google sometimes never answers).
      const res = await inTurn(() =>
        fetchFn(`${API}/${model}:generateContent`, {
          method: "POST",
          headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts }],
            generationConfig: { temperature, ...(json ? { responseMimeType: "application/json" } : {}), maxOutputTokens },
          }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        }),
      ).catch((err) => {
        if (err.name === "TimeoutError" && attempt < RETRIES) return null;
        throw err.name === "TimeoutError" ? new Error(`Gemini did not answer in ${TIMEOUT_MS / 1000} seconds`) : err;
      });
      if (!res) continue;
      if (res.ok) {
        const data = await res.json();
        const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
        if (!text) throw new Error(`Gemini gave no answer (${data.candidates?.[0]?.finishReason || data.promptFeedback?.blockReason || "unknown"})`);
        return text;
      }
      // 429 = free limit reached for this minute, 500/503 = Google busy: wait and try again.
      if ((res.status === 429 || res.status >= 500) && attempt < RETRIES) {
        const body = await res.text();
        // The free limit for the whole day is used up: waiting will not help.
        if (res.status === 429 && /PerDay/i.test(body)) throw new Error(`Gemini error 429: the free daily limit of ${model} is used up`);
        const hinted = Number(/"retryDelay":\s*"(\d+)/.exec(body)?.[1]);
        await sleep((hinted || 20 * (attempt + 1)) * 1000);
        continue;
      }
      throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  };
}

export function createGeminiAi({ rules, topics = [], states = [], lessons = "", apiKey = process.env.GEMINI_API_KEY, fetchFn = fetch, gapMs = GAP_MS, log = console.log } = {}) {
  const generate = createGeminiCaller({ apiKey, fetchFn, gapMs });

  const STYLE = {
    bn: "Bengali: natural, standard Bengali as used by newspapers in Tripura",
    hi: "Hindi: simple, standard Hindi as used by Indian Hindi newspapers (Devanagari script)",
    as: "Assamese: standard Assamese as used by newspapers in Guwahati (Assamese script, not Bengali spellings)",
    ne: "Nepali: standard Nepali as used in Sikkim and Darjeeling newspapers (Devanagari script)",
    trp: "Kokborok: standard Kokborok as used in Tripura, written in Latin script (Roman letters, not Bengali script)",
    trpb: "Kokborok written in Bengali script (ককবরক in বাংলা লিপি), the way many readers in Tripura write Kokborok: Kokborok words spelled with Bengali letters, not Bengali words",
  };
  // How the Bengali-script Kokborok is made: always the same text as the Roman-script version, only spelled differently.
  const scriptRule = (codes, hasLatin) =>
    !codes.includes("trpb")
      ? ""
      : codes.includes("trp")
        ? `\n"trpb" must be exactly the same Kokborok text as "trp", only spelled in Bengali script: do not translate again and do not change any word or meaning.`
        : hasLatin
          ? `\n"trpb" must be the Kokborok text given as "kokborok_latin" in the input, only spelled in Bengali script: do not translate again and do not change any word or meaning.`
          : "";
  const translationSystem = (codes, hasLatin = false) => {
    const Result = z.object(Object.fromEntries(codes.map((c) => [c, z.object({ headline: z.string(), summary: z.string() })])));
    return [
      Result,
      `You translate short news items for InsightNE News, a news website for Northeast India.
Translate the English headline and summary into each of these languages:
${codes.map((c) => `- "${c}" = ${STYLE[c]}`).join("\n")}
Keep the meaning exact: add nothing, leave nothing out, no opinions. Write names of people, places, parties and
organisations the way newspapers in that language usually write them.${scriptRule(codes, hasLatin)}
Reply with only one JSON object that matches this JSON schema, and nothing else:
${JSON.stringify(z.toJSONSchema(Result))}`,
    ];
  };

  return {
    model: `Gemini (${MODEL}) summaries + simple rules`,

    // The headline and summary in the given languages, in one request: { bn: {headline, summary}, hi: {...}, ... }
    // `trp` is the story's existing Roman-script Kokborok, used when only the Bengali-script version is still missing.
    async translate({ headline, summary, trp }, codes = ["bn"]) {
      const wanted = codes.filter((c) => STYLE[c]);
      if (!wanted.length) return {};
      const latin = wanted.includes("trpb") && !wanted.includes("trp") && trp?.headline && trp?.summary ? { headline: trp.headline, summary: trp.summary } : null;
      const [Result, system] = translationSystem(wanted, Boolean(latin));
      const out = parseJsonReply(await generate(system, JSON.stringify({ headline, summary, ...(latin && { kokborok_latin: latin }) })), Result);
      return Object.fromEntries(wanted.map((c) => [c, { headline: out[c].headline.trim(), summary: out[c].summary.trim() }]));
    },
    score: (articles) => rules.score(articles),
    group: (articles, existing) => rules.group(articles, existing),

    // Same answer as the Claude version. If Gemini fails, the story still arrives with an empty
    // summary, so it waits on the approval page for you to write one (as in no-AI mode).
    async summarize(articles, extraInstruction = "") {
      const list = articles.map((a) => ({ source: a.sourceName, home_state: a.sourceRegion !== "Northeast" ? a.sourceRegion : undefined, headline: a.title, snippet: a.snippet }));
      const system = `${SUMMARY_SYSTEM}\nSTATES: ${JSON.stringify(states)}\nTOPICS: ${JSON.stringify(topics)}${lessons}\n\nReply with only one JSON object that matches this JSON schema, and nothing else:\n${JSON.stringify(z.toJSONSchema(SummaryResult))}`;
      try {
        const out = parseJsonReply(await generate(system, `${extraInstruction}Sources:\n${JSON.stringify(list, null, 1)}`), SummaryResult);
        return {
          headline: houseText(out.headline.trim()),
          summary: houseText(out.summary.trim()),
          region: pickRegion(out.region, states),
          topic: topics.includes(out.topic) ? out.topic : null,
          needsCheck: out.needs_extra_check,
          checkReasons: out.check_reasons,
        };
      } catch (err) {
        log(`  ✗ Gemini could not summarize "${articles[0].title}", left for you to write: ${err.message}`);
        return rules.summarize(articles);
      }
    },
  };
}
