// Reads the RSS feeds listed in sources.json.
import Parser from "rss-parser";
import { cleanText, normalizeUrl } from "./text.js";

const parser = new Parser({
  timeout: 20000,
  headers: { "User-Agent": "Mozilla/5.0 (compatible; InsightNE-News-Bot/1.0; +https://www.youtube.com/@InsightNE)" },
});

// Reads every feed. A feed that fails is written into `failed` and skipped;
// it never stops the others.
export async function fetchAllFeeds(sources, { newerThanHours = 48, now = new Date() } = {}) {
  const cutoff = now.getTime() - newerThanHours * 3600 * 1000;
  const failed = [];
  let okCount = 0;
  const byUrl = new Map();

  const results = await Promise.allSettled(sources.map((s) => parser.parseURL(s.feed)));

  results.forEach((result, i) => {
    const source = sources[i];
    if (result.status === "rejected") {
      failed.push({ name: source.name, feed: source.feed, error: String(result.reason?.message || result.reason).slice(0, 200) });
      return;
    }
    okCount++;
    for (const item of result.value.items || []) {
      const link = item.link || item.guid;
      const title = cleanText(item.title || "", 300);
      if (!link || !title || !/^https?:\/\//.test(link)) continue;

      const published = item.isoDate || item.pubDate ? new Date(item.isoDate || item.pubDate) : null;
      if (published && !isNaN(published) && published.getTime() < cutoff) continue;

      const url = normalizeUrl(link);
      if (byUrl.has(url)) {
        // The same article can be in a site's main feed and a state feed (e.g. Tripura); remember the state.
        if (source.region && source.region !== "Northeast") byUrl.get(url).sourceRegion = source.region;
        continue;
      }
      byUrl.set(url, {
        url,
        link,
        sourceName: source.name,
        sourceRegion: source.region || "Northeast",
        title,
        snippet: cleanText(item.contentSnippet || item.summary || item.content || "", 400),
        publishedAt: published && !isNaN(published) ? published.toISOString() : null,
      });
    }
  });

  return { articles: [...byUrl.values()], okCount, failed };
}
