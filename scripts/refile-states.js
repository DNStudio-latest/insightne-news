// One-time tool: files existing news briefs under their state (Assam, Manipur, …) using the place names
// in their headlines. Your own reports are never changed. Run with:  npm run refile-states
import { db } from "../lib/db.js";
import { ruleRegion } from "../lib/rules.js";
import sourcesFile from "../sources.json" with { type: "json" };

const tripuraPapers = new Set(sourcesFile.sources.filter((s) => s.region === "Tripura").map((s) => s.name));
let changed = 0;

for (const status of ["pending", "approved", "rejected"]) {
  for (const story of await db.listStories({ status, limit: 2000 })) {
    if (story.kind === "original") continue;
    const articles = story.sources.map((s) => ({
      title: s.original_title || story.headline,
      snippet: s.snippet || "",
      sourceRegion: tripuraPapers.has(s.source_name) && story.region === "Tripura" ? "Tripura" : undefined,
    }));
    const region = ruleRegion(articles.length ? articles : [{ title: story.headline }]);
    if (region !== story.region) {
      await db.updateStory(story.id, { region });
      console.log(`${story.region.padEnd(10)} → ${region.padEnd(18)} ${story.headline.slice(0, 70)}`);
      changed++;
    }
  }
}
console.log(`Done. ${changed} stories re-filed.`);
