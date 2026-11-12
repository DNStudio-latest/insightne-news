// Topic pages for running stories (hubs.json) and the related stories shown under each story.
// Imported (not read from disk) so the file is bundled with the site on Vercel, like settings.json.
import hubsFile from "../hubs.json" with { type: "json" };

export const allHubs = () => hubsFile.hubs || [];
export const hubBySlug = (slug) => allHubs().find((h) => h.slug === slug) || null;

const text = (s) => `${s?.headline || ""} ${s?.summary || ""}`.toLowerCase();
export const storyInHub = (story, hub) => hub.keywords.some((k) => text(story).includes(k.toLowerCase()));
export const hubsForStory = (story) => allHubs().filter((h) => storyInHub(story, h));

const STOP = new Set("about after again against among being between during first from have into over said says that their there these they this those under what when where which while with would could should also more than only other some such then very will been were your tripura assam meghalaya manipur mizoram nagaland arunachal sikkim northeast india indian state government minister chief police".split(" "));
const words = (s) => new Set((String(s || "").toLowerCase().match(/\p{L}{5,}/gu) || []).filter((w) => !STOP.has(w)));

// Up to `count` stories from `pool` that belong with `story`: shared topic words in the headline count most, then the
// same topic and the same region. Falls back to the newest stories of the same region.
export function relatedStories(story, pool, count = 3) {
  const mine = words(story.headline);
  const scored = pool
    .filter((s) => s.id !== story.id)
    .map((s) => {
      let score = 0;
      for (const w of words(s.headline)) if (mine.has(w)) score += 2;
      if (story.topic && s.topic === story.topic) score += 1;
      if (s.region === story.region) score += 1;
      return { s, score };
    });
  const strong = scored.filter((x) => x.score >= 3).sort((a, b) => b.score - a.score);
  const rest = scored.filter((x) => x.score < 3 && x.s.region === story.region);
  return [...strong, ...rest].slice(0, count).map((x) => x.s);
}
