// Run with:  npm run collect
// On the internet this runs automatically every 3 hours (see .github/workflows/collect.yml).
import { db, usingSupabase } from "../lib/db.js";
import { createClaudeAi } from "../lib/ai.js";
import { createGeminiAi } from "../lib/gemini.js";
import { createRulesAi } from "../lib/rules.js";
import { runPipeline, fillMissingSummaries, fillMissingBengali } from "../lib/pipeline.js";
import { addMissingIllustrations } from "../lib/images.js";
import { settings, states, enabledSources, trustedSourceNames } from "../lib/config.js";

// With a Claude key, Claude scores and summarizes. With a free Gemini key, simple rules score the news
// and Gemini writes the summaries. With neither, you write the summaries yourself ("no-AI mode", free).
const hasClaudeKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY);
const rules = createRulesAi({ topics: settings.topics });
const ai = hasClaudeKey
  ? createClaudeAi({ topics: settings.topics, states })
  : process.env.GEMINI_API_KEY
    ? createGeminiAi({ rules, topics: settings.topics, states })
    : rules;

console.log(`InsightNE News collector — ${new Date().toISOString()}`);
console.log(`Saving to: ${usingSupabase ? "Supabase (online)" : "data/local-db.json (on this computer)"}. Mode: ${ai.model}`);

const run = await runPipeline({
  db,
  ai,
  sources: enabledSources(),
  settings,
  trusted: trustedSourceNames(),
});

// Stories that arrived without a summary (for example in no-AI mode) get one now.
await fillMissingSummaries({ db, ai });

// Bengali headline and summary for each story (only with Gemini).
await fillMissingBengali({ db, ai });

// Published stories without a photo get a labelled AI illustration (only if Cloudflare is set up).
await addMissingIllustrations({ db });

console.log("Done.", JSON.stringify({ ...run, feeds_failed: run.feeds_failed.map((f) => f.name) }));
// Feed problems are normal; only a full stop counts as a failure.
process.exit(run.error && run.stories_created === 0 && run.articles_kept > 0 ? 1 : 0);
