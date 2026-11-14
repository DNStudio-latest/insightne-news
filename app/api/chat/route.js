// "Ask InsightNE": answers a visitor's question from the stories published on the website (see lib/reader-chat.js).
// Questions and answers are not stored. Each visitor can ask a limited number of questions, and the whole website
// has a daily limit (CHAT_DAILY_LIMIT, default 400 with Gemini and 1500 with Claude), so the AI bill cannot run away.
import { db } from "../../../lib/db.js";
import { answerReader, chatEnabled, chatProvider, LIMITS } from "../../../lib/reader-chat.js";
import { clientIp, rateLimit, tooMany } from "../../../lib/rate-limit.js";

export const dynamic = "force-dynamic";

// Free Gemini has a small daily allowance, so its default is lower than Claude's.
const dailyLimit = () => Math.max(1, Number(process.env.CHAT_DAILY_LIMIT) || (chatProvider() === "gemini" ? 400 : 1500));

export async function POST(request) {
  if (!chatEnabled()) return Response.json({ error: "The chat is switched off." }, { status: 404 });
  try {
    const body = await request.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question) return Response.json({ error: "Please type a question." }, { status: 400 });
    if (question.length > LIMITS.question) return Response.json({ error: `Please keep your question under ${LIMITS.question} characters.` }, { status: 400 });

    // A phone network can share one address between many readers, so the limit is generous.
    const ip = clientIp(request.headers);
    if (!(await rateLimit({ key: `chat:${ip}`, limit: 15, windowSec: 600 })).ok) return tooMany(600);
    if (!(await rateLimit({ key: "chat:all", limit: dailyLimit(), windowSec: 86400 })).ok) {
      return Response.json({ error: "The chat is busy today. Please use Search or try again tomorrow." }, { status: 429 });
    }

    const result = await answerReader(question, { history: body.history, lang: body.lang, store: db });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("chat failed:", err?.message);
    if (/\b429\b/.test(err?.message || "")) return Response.json({ error: "The chat is busy right now. Please try again in a minute, or use Search." }, { status: 429 });
    return Response.json({ error: "Sorry, the chat could not answer just now. Please try again." }, { status: 500 });
  }
}
