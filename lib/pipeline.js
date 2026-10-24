// The six steps: COLLECT -> SELECT -> ARRANGE -> SUMMARIZE -> FLAG -> SAVE as pending.
import { fetchAllFeeds } from "./feeds.js";
import { findCopiedPhrase, sensitiveKeywordReasons } from "./text.js";

const SCORE_BATCH = 25;

async function inBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(await fn(items.slice(i, i + size)));
  return out;
}

// Runs fn on each item, a few at a time.
async function eachLimited(items, limit, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

// Makes sure every article ends up in exactly one group, even if the AI missed or repeated one.
export function cleanGroups(groups, articleIds, existingIds) {
  const remaining = new Set(articleIds);
  const clean = [];
  for (const g of groups) {
    const ids = g.articleIds.filter((id) => remaining.has(id));
    ids.forEach((id) => remaining.delete(id));
    if (ids.length) clean.push({ articleIds: ids, existingStoryId: existingIds.has(g.existingStoryId) ? g.existingStoryId : null });
  }
  for (const id of remaining) clean.push({ articleIds: [id], existingStoryId: null });
  return clean;
}

export async function runPipeline({ db, ai, sources, settings, trusted = new Set(), fetchFeeds = fetchAllFeeds, log = console.log, practiceMode = false }) {
  const run = {
    started_at: new Date().toISOString(),
    practice_mode: practiceMode,
    feeds_ok: 0,
    feeds_failed: [],
    articles_new: 0,
    articles_kept: 0,
    stories_created: 0,
    stories_updated: 0,
    auto_published: 0,
    error: null,
  };

  try {
    // 1. COLLECT
    log(`Checking ${sources.length} news feeds…`);
    const { articles, okCount, failed } = await fetchFeeds(sources, { newerThanHours: settings.onlyArticlesNewerThanHours });
    run.feeds_ok = okCount;
    run.feeds_failed = failed;
    failed.forEach((f) => log(`  ✗ Skipped ${f.name} (${f.feed}): ${f.error}`));

    const seen = await db.seenUrls(articles.map((a) => a.url));
    let fresh = articles.filter((a) => !seen.has(a.url));
    if (fresh.length > settings.maxArticlesPerRun) {
      log(`  ${fresh.length} new articles; only the newest ${settings.maxArticlesPerRun} are checked this time (cost limit).`);
      fresh = fresh.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0, settings.maxArticlesPerRun);
    }
    fresh.forEach((a, i) => (a.id = `a${i + 1}`));
    run.articles_new = fresh.length;
    log(`  ${okCount} feeds worked, ${failed.length} failed. ${fresh.length} new articles.`);
    if (!fresh.length) return run;

    // 2. SELECT: score every new article. A batch that fails is not marked as seen, so it is retried next time.
    const scores = new Map();
    await inBatches(fresh, SCORE_BATCH, async (batch) => {
      try {
        const result = await ai.score(batch);
        const scored = batch.filter((a) => result.has(a.id));
        scored.forEach((a) => scores.set(a.id, result.get(a.id)));
        await db.markSeen(scored.map((a) => ({ url: a.url, source_name: a.sourceName, title: a.title, score: result.get(a.id) })));
      } catch (err) {
        log(`  ✗ Scoring failed for ${batch.length} articles (will retry next run): ${err.message}`);
        run.error = `Scoring: ${err.message}`;
      }
    });
    const kept = fresh.filter((a) => (scores.get(a.id) ?? 0) >= settings.minimumScore);
    run.articles_kept = kept.length;
    log(`  ${kept.length} articles scored ${settings.minimumScore} or more.`);
    if (!kept.length) return run;

    // 3. ARRANGE: group reports of the same event, and match them to stories we already have.
    const existing = await db.recentStories(3);
    const existingIds = new Set(existing.map((s) => s.id));
    let groups;
    try {
      groups = await ai.group(kept, existing);
    } catch (err) {
      log(`  ✗ Grouping failed, keeping every article separate: ${err.message}`);
      groups = [];
    }
    groups = cleanGroups(groups, kept.map((a) => a.id), existingIds);
    const byId = new Map(kept.map((a) => [a.id, a]));

    // 4–6. SUMMARIZE, FLAG, SAVE
    await eachLimited(groups, 4, async (group) => {
      const items = group.articleIds.map((id) => byId.get(id));
      const sourceRows = items.map((a) => ({ source_name: a.sourceName, url: a.url, original_title: a.title, published_at: a.publishedAt }));

      if (group.existingStoryId) {
        await db.addSources(group.existingStoryId, sourceRows);
        run.stories_updated++;
        return;
      }

      try {
        const originals = items.flatMap((a) => [a.title, a.snippet]);
        let s = await ai.summarize(items);
        let copied = findCopiedPhrase(s.summary, originals);
        if (copied) {
          s = await ai.summarize(items, `Your last summary copied the words "${copied}" from a source. Rewrite fully in your own words.\n`);
          copied = findCopiedPhrase(s.summary, originals);
        }

        const reasons = new Set(s.checkReasons);
        if (copied) reasons.add(`Summary repeats source wording ("${copied}") — please rewrite`);
        const keywordReasons = sensitiveKeywordReasons(`${s.headline} ${s.summary} ${originals.join(" ")}`);
        keywordReasons.forEach((r) => reasons.add(r));
        const needsCheck = s.needsCheck || reasons.size > 0;

        const story = {
          headline: s.headline,
          summary: s.summary,
          region: s.region,
          topic: s.topic,
          score: Math.max(...items.map((a) => scores.get(a.id))),
          needs_check: needsCheck,
          check_reasons: [...reasons],
          status: "pending",
        };

        // FUTURE OPTION (off by default): publish straight away only when switched on,
        // every source is trusted, and nothing needs an extra check.
        const allTrusted = items.every((a) => trusted.has(a.sourceName));
        if (settings.autoPublish?.enabled && allTrusted && !needsCheck) {
          story.status = "approved";
          story.auto_published = true;
          story.published_at = new Date().toISOString();
          run.auto_published++;
        }

        await db.createStory(story, sourceRows);
        run.stories_created++;
      } catch (err) {
        log(`  ✗ Could not summarize "${items[0].title}": ${err.message}`);
        run.error = `Summary: ${err.message}`;
      }
    });

    log(`  ${run.stories_created} new stories waiting for approval, ${run.stories_updated} existing stories got extra sources.`);
    await db.forgetSeenOlderThan(30);
    return run;
  } catch (err) {
    run.error = err.message;
    log(`✗ Run stopped: ${err.message}`);
    return run;
  } finally {
    run.finished_at = new Date().toISOString();
    try {
      await db.logRun(run);
    } catch (err) {
      log(`✗ Could not save the run report: ${err.message}`);
    }
  }
}
