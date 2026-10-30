// Run with:  npm run hunt
// On the internet this runs at 2 PM, 6 PM and 9 PM India time (see .github/workflows/hunt.yml and supabase/hunter-timer.sql).
// It finds new government notices, press releases and official videos, and writes drafts for your approval.
import hunterConfig from "../hunter.json" with { type: "json" };
import { settings, states } from "../lib/config.js";
import { createGeminiCaller } from "../lib/gemini.js";
import { createHunterAi } from "../lib/hunter/ai.js";
import { createPoliteFetcher } from "../lib/hunter/polite.js";
import { createRelayFetch } from "../lib/hunter/relay.js";
import { createProofCapturer } from "../lib/hunter/proof.js";
import { hunterStore } from "../lib/hunter/store.js";
import { runHunter } from "../lib/hunter/run.js";
import { createTelegramAlert } from "../lib/hunter/alert.js";
import { db } from "../lib/db.js";

// "--read-only" tests finding and reading items without AI (no key needed, no drafts written).
const readOnly = process.argv.includes("--read-only");
if (!readOnly && !process.env.GEMINI_API_KEY) {
  console.log("The News Hunter needs GEMINI_API_KEY (free, from aistudio.google.com). Nothing was done.");
  process.exit(1);
}

// Flash-Lite decides what is news (cheap, many requests); the stronger Flash model writes the drafts.
const quick = createGeminiCaller({ maxOutputTokens: 4000 });
const writer = createGeminiCaller({ model: process.env.HUNTER_MODEL || "gemini-flash-latest", maxOutputTokens: 4000 });
const judgeAi = createHunterAi({ generate: quick, states, topics: settings.topics });
const draftAi = createHunterAi({ generate: writer, states, topics: settings.topics });
// If the stronger model's free limit runs out (or it stops answering), the rest of the drafts are written by Flash-Lite.
let writerDown = false;
async function draft(docs) {
  if (!writerDown) {
    try {
      return await draftAi.draft(docs);
    } catch (err) {
      if (!/429|50\d|did not answer/.test(err.message)) throw err;
      writerDown = true;
      console.log(`  ⚠ ${err.message} — Flash-Lite writes the rest of the drafts`);
    }
  }
  return judgeAi.draft(docs);
}
const ai = { judge: judgeAi.judge, draft };

// On GitHub (in the USA), government websites are fetched through the website's Mumbai server.
const fetchFn = process.env.GITHUB_ACTIONS ? createRelayFetch() : fetch;

console.log(`InsightNE News Hunter — ${new Date().toISOString()}`);
// Screenshots of the source pages (proof). Not used in the read-only test.
const proof = readOnly ? null : createProofCapturer();
// Urgent items are sent to the editor's phone (Telegram), if the secrets are set.
const alert = readOnly ? null : createTelegramAlert({ token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID });
if (!readOnly && !alert) console.log("Urgent phone alerts are off: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are not set.");
const run = await runHunter({ store: hunterStore, get: createPoliteFetcher({ fetchFn }), ai, generate: quick, config: hunterConfig, readOnly, proof, site: db, alert });
await proof?.close();
console.log("Done.", JSON.stringify({ ...run, pages_failed: run.pages_failed.map((f) => `${f.name}: ${f.error}`) }, null, 1));
process.exit(run.error ? 1 : 0);
