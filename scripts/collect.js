// Run with:  npm run collect
// On the internet this runs automatically every 3 hours (see .github/workflows/collect.yml).
import { db, usingSupabase } from "../lib/db.js";
import { createClaudeAi } from "../lib/ai.js";
import { createRulesAi } from "../lib/rules.js";
import { runPipeline } from "../lib/pipeline.js";
import { settings, states, enabledSources, trustedSourceNames } from "../lib/config.js";

// With a Claude key, Claude scores and summarizes. Without one, simple rules score the news
// and you write the summaries yourself on the approval page ("no-AI mode", free).
const hasClaudeKey = Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY);
const ai = hasClaudeKey ? createClaudeAi({ topics: settings.topics, states }) : createRulesAi({ topics: settings.topics });

console.log(`InsightNE News collector — ${new Date().toISOString()}`);
console.log(`Saving to: ${usingSupabase ? "Supabase (online)" : "data/local-db.json (on this computer)"}. Mode: ${ai.model}`);

const run = await runPipeline({
  db,
  ai,
  sources: enabledSources(),
  settings,
  trusted: trustedSourceNames(),
});

console.log("Done.", JSON.stringify({ ...run, feeds_failed: run.feeds_failed.map((f) => f.name) }));
// Feed problems are normal; only a full stop counts as a failure.
process.exit(run.error && run.stories_created === 0 && run.articles_kept > 0 ? 1 : 0);
