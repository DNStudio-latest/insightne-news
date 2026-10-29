// Run with:  npm run hunt
// On the internet this runs at 2 PM, 6 PM and 9 PM India time (see .github/workflows/hunt.yml and supabase/hunter-timer.sql).
// It finds new government notices, press releases and official videos, and writes drafts for your approval.
import hunterConfig from "../hunter.json" with { type: "json" };
import { settings, states } from "../lib/config.js";
import { createGeminiCaller } from "../lib/gemini.js";
import { createHunterAi } from "../lib/hunter/ai.js";
import { createPoliteFetcher } from "../lib/hunter/polite.js";
import { hunterStore } from "../lib/hunter/store.js";
import { runHunter } from "../lib/hunter/run.js";

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
const ai = { judge: judgeAi.judge, draft: draftAi.draft };

console.log(`InsightNE News Hunter — ${new Date().toISOString()}`);
const run = await runHunter({ store: hunterStore, get: createPoliteFetcher(), ai, generate: quick, config: hunterConfig, readOnly });
console.log("Done.", JSON.stringify({ ...run, pages_failed: run.pages_failed.map((f) => `${f.name}: ${f.error}`) }, null, 1));
process.exit(run.error ? 1 : 0);
