// Automatic checks. Run with:  npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "insightne-test-"));
process.env.LOCAL_DB_FILE = path.join(tmp, "db.json");
delete process.env.SUPABASE_URL;

const { db } = await import("../lib/db.js");
const { runPipeline, cleanGroups } = await import("../lib/pipeline.js");
const { createClaudeAi } = await import("../lib/ai.js");
const { findCopiedPhrase, sensitiveKeywordReasons, normalizeUrl, cleanText } = await import("../lib/text.js");
const { fetchAllFeeds } = await import("../lib/feeds.js");

const settings = { minimumScore: 6, onlyArticlesNewerThanHours: 48, maxArticlesPerRun: 200, autoPublish: { enabled: false } };
const quiet = () => {};

function article(n, source, title, snippet = "") {
  return { url: `https://example.com/${n}`, link: `https://example.com/${n}`, sourceName: source, title, snippet, publishedAt: new Date().toISOString() };
}

// A pretend AI with fixed answers, so tests cost nothing.
function fakeAi({ scores, groups, summaries = {} }) {
  return {
    async score(batch) {
      return new Map(batch.map((a) => [a.id, scores[a.title] ?? 1]));
    },
    async group(articles) {
      return groups(articles);
    },
    async summarize(items, extra) {
      const s = summaries[items[0].title] || {};
      const summary = typeof s.summary === "function" ? s.summary(extra) : s.summary;
      return { headline: `Our headline: ${items[0].title}`, summary: summary || "A calm summary written in fresh words for readers.", region: "Tripura", topic: null, needsCheck: false, checkReasons: [], ...s, ...(summary ? { summary } : {}) };
    },
  };
}

function reset() {
  fs.rmSync(process.env.LOCAL_DB_FILE, { force: true });
}

test("text helpers", () => {
  assert.equal(normalizeUrl("https://www.site.in/a/?utm_source=x&id=2#top"), "https://site.in/a/?id=2");
  assert.equal(cleanText("<p>Hello&nbsp;<b>Agartala</b> &amp; more</p>"), "Hello Agartala & more");
  assert.equal(findCopiedPhrase("The state government on Friday announced a new scheme today", ["The state government on Friday announced a new scheme for farmers"]), "the state government on friday announced a new");
  assert.equal(findCopiedPhrase("Farmers will get help under a fresh plan", ["The state government on Friday announced a new scheme for farmers"]), null);
  assert.deepEqual(sensitiveKeywordReasons("Two killed in road accident"), ["Mentions violence", "Mentions accident"]);
  assert.deepEqual(sensitiveKeywordReasons("New college opens in Udaipur"), []);
});

test("a broken feed is skipped and the others still work", async () => {
  const good = "data:text/xml," + encodeURIComponent(`<?xml version="1.0"?><rss version="2.0"><channel><title>T</title><item><title>Agartala news</title><link>https://example.com/x</link><pubDate>${new Date().toUTCString()}</pubDate><description>Short text</description></item></channel></rss>`);
  // A data: address cannot be read by the feed reader, so we serve the good feed from a tiny local server.
  const http = await import("node:http");
  const server = http.createServer((req, res) => {
    if (req.url === "/good") {
      res.setHeader("content-type", "application/rss+xml");
      res.end(decodeURIComponent(good.slice("data:text/xml,".length)));
    } else {
      res.statusCode = 500;
      res.end("broken");
    }
  });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  const { articles, okCount, failed } = await fetchAllFeeds([
    { name: "Good", feed: `http://127.0.0.1:${port}/good` },
    { name: "Broken", feed: `http://127.0.0.1:${port}/broken` },
    { name: "Missing", feed: "http://127.0.0.1:1/nothing" },
  ]);
  server.close();
  assert.equal(okCount, 1);
  assert.deepEqual(failed.map((f) => f.name), ["Broken", "Missing"]);
  assert.equal(articles.length, 1);
  assert.equal(articles[0].title, "Agartala news");
});

test("selects, groups duplicates, flags, and keeps everything pending", async () => {
  reset();
  const feed = [
    article(1, "Tripura Times", "Flood alert in Agartala"),
    article(2, "EastMojo", "Agartala on flood alert as river rises"),
    article(3, "Syllad", "Film star visits Shillong cafe"),
    article(4, "Northeast Now", "Two arrested after clash in Dharmanagar"),
  ];
  const ai = fakeAi({
    scores: { "Flood alert in Agartala": 9, "Agartala on flood alert as river rises": 8, "Film star visits Shillong cafe": 2, "Two arrested after clash in Dharmanagar": 7 },
    groups: (arts) => [{ articleIds: [arts[0].id, arts[1].id], existingStoryId: null }, { articleIds: [arts[2].id], existingStoryId: null }],
  });
  const run = await runPipeline({ db, ai, sources: [], settings, fetchFeeds: async () => ({ articles: feed, okCount: 3, failed: [] }), log: quiet });

  assert.equal(run.articles_new, 4);
  assert.equal(run.articles_kept, 3);
  assert.equal(run.stories_created, 2); // the two flood reports became one story
  const pending = await db.listStories({ status: "pending" });
  assert.equal(pending.length, 2);
  const flood = pending.find((s) => s.headline.includes("Flood"));
  assert.equal(flood.sources.length, 2);
  assert.equal(flood.score, 9);
  const clash = pending.find((s) => s.headline.includes("clash"));
  assert.equal(clash.needs_check, true);
  assert.ok(clash.check_reasons.includes("Mentions crime"));
  assert.equal((await db.listStories({ status: "approved" })).length, 0, "nothing is published without approval");

  // Running again does not re-score the same articles.
  const again = await runPipeline({ db, ai, sources: [], settings, fetchFeeds: async () => ({ articles: feed, okCount: 3, failed: [] }), log: quiet });
  assert.equal(again.articles_new, 0);
});

test("a new report of a known story is added to it as an extra source", async () => {
  reset();
  const first = [article(10, "Tripura Times", "Budget session begins")];
  const ai1 = fakeAi({ scores: { "Budget session begins": 8 }, groups: (a) => [{ articleIds: [a[0].id], existingStoryId: null }] });
  await runPipeline({ db, ai: ai1, sources: [], settings, fetchFeeds: async () => ({ articles: first, okCount: 1, failed: [] }), log: quiet });
  const [story] = await db.listStories({ status: "pending" });

  const second = [article(11, "EastMojo", "Tripura budget session starts")];
  const ai2 = fakeAi({ scores: { "Tripura budget session starts": 8 }, groups: (a) => [{ articleIds: [a[0].id], existingStoryId: story.id }] });
  const run = await runPipeline({ db, ai: ai2, sources: [], settings, fetchFeeds: async () => ({ articles: second, okCount: 1, failed: [] }), log: quiet });
  assert.equal(run.stories_updated, 1);
  const [updated] = await db.listStories({ status: "pending" });
  assert.deepEqual(updated.sources.map((s) => s.source_name).sort(), ["EastMojo", "Tripura Times"]);
});

test("copied wording is caught: asks again, then flags if still copied", async () => {
  reset();
  const snippet = "The state government on Friday announced a new scheme for farmers in all districts";
  const feed = [article(20, "Tripura Times", "New farm scheme", snippet), article(21, "EastMojo", "Second scheme", snippet)];
  const ai = fakeAi({
    scores: { "New farm scheme": 8, "Second scheme": 8 },
    groups: (a) => a.map((x) => ({ articleIds: [x.id], existingStoryId: null })),
    summaries: {
      "New farm scheme": { summary: (extra) => (extra ? "Farmers across Tripura will get support under a plan unveiled by the government." : snippet) },
      "Second scheme": { summary: () => snippet },
    },
  });
  await runPipeline({ db, ai, sources: [], settings, fetchFeeds: async () => ({ articles: feed, okCount: 1, failed: [] }), log: quiet });
  const stories = await db.listStories({ status: "pending" });
  const fixed = stories.find((s) => s.headline.includes("New farm"));
  const stuck = stories.find((s) => s.headline.includes("Second"));
  assert.ok(!fixed.check_reasons.some((r) => r.includes("repeats source wording")));
  assert.ok(stuck.needs_check);
  assert.ok(stuck.check_reasons.some((r) => r.includes("repeats source wording")));
});

test("auto-publish: off by default; when on, only trusted + unflagged stories go live", async () => {
  const feed = [article(30, "Trusted Paper", "College results declared"), article(31, "Other Paper", "School reopens"), article(32, "Trusted Paper", "Man arrested in theft case")];
  const ai = fakeAi({
    scores: { "College results declared": 8, "School reopens": 8, "Man arrested in theft case": 8 },
    groups: (a) => a.map((x) => ({ articleIds: [x.id], existingStoryId: null })),
  });
  const trusted = new Set(["Trusted Paper"]);

  reset();
  await runPipeline({ db, ai, sources: [], settings, trusted, fetchFeeds: async () => ({ articles: feed, okCount: 1, failed: [] }), log: quiet });
  assert.equal((await db.listStories({ status: "approved" })).length, 0);

  reset();
  const on = { ...settings, autoPublish: { enabled: true } };
  const run = await runPipeline({ db, ai, sources: [], settings: on, trusted, fetchFeeds: async () => ({ articles: feed, okCount: 1, failed: [] }), log: quiet });
  const live = await db.listStories({ status: "approved" });
  assert.equal(run.auto_published, 1);
  assert.deepEqual(live.map((s) => s.headline), ["Our headline: College results declared"]);
});

test("if the AI fails, nothing crashes and articles are retried next run", async () => {
  reset();
  const feed = [article(40, "Tripura Times", "Power cut schedule")];
  const broken = { score: async () => { throw new Error("spending limit reached"); }, group: async () => [], summarize: async () => ({}) };
  const run = await runPipeline({ db, ai: broken, sources: [], settings, fetchFeeds: async () => ({ articles: feed, okCount: 1, failed: [] }), log: quiet });
  assert.match(run.error, /spending limit/);
  assert.equal((await db.seenUrls([feed[0].url])).size, 0, "not marked as seen, so it is tried again");
});

test("cleanGroups puts every article in exactly one group", () => {
  const out = cleanGroups([{ articleIds: ["a1", "a2", "a9"], existingStoryId: "made-up" }, { articleIds: ["a2"], existingStoryId: null }], ["a1", "a2", "a3"], new Set(["real"]));
  assert.deepEqual(out, [{ articleIds: ["a1", "a2"], existingStoryId: null }, { articleIds: ["a3"], existingStoryId: null }]);
});

test("Claude requests use Haiku, low effort and a strict answer format", async () => {
  const calls = [];
  const client = {
    messages: {
      async parse(params) {
        calls.push(params);
        if (params.system.startsWith("You are a senior news editor")) return { stop_reason: "end_turn", parsed_output: { scores: [{ id: "a1", score: 14 }] } };
        if (params.system.startsWith("You are a news editor removing")) return { stop_reason: "end_turn", parsed_output: { groups: [{ article_ids: ["a1"], existing_story_id: null }] } };
        return { stop_reason: "end_turn", parsed_output: { headline: " H ", summary: " S ", region: "Assam", topic: "Cooking", needs_extra_check: true, check_reasons: ["Rumour"] } };
      },
    },
  };
  const ai = createClaudeAi({ client, topics: ["Politics"] });
  const scores = await ai.score([{ id: "a1", sourceName: "X", title: "T", snippet: "S" }]);
  assert.equal(scores.get("a1"), 10, "scores are kept between 1 and 10");
  const groups = await ai.group([{ id: "a1", sourceName: "X", title: "T" }], []);
  assert.deepEqual(groups, [{ articleIds: ["a1"], existingStoryId: null }]);
  const s = await ai.summarize([{ sourceName: "X", title: "T", snippet: "S" }]);
  assert.deepEqual(s, { headline: "H", summary: "S", region: "Northeast", topic: null, needsCheck: true, checkReasons: ["Rumour"] });

  for (const c of calls) {
    assert.equal(c.model, "claude-haiku-5-5");
    assert.equal(c.output_config.effort, "low");
    assert.equal(c.output_config.format.type, "json_schema");
  }

  const refusing = createClaudeAi({ client: { messages: { parse: async () => ({ stop_reason: "refusal", parsed_output: null }) } } });
  await assert.rejects(refusing.score([{ id: "a1" }]), /declined/);
});

test("if the service refuses the strict format, Claude is asked for plain JSON instead", async () => {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  let parseCalls = 0;
  const created = [];
  const client = {
    messages: {
      async parse() {
        parseCalls++;
        throw Object.create(Anthropic.BadRequestError.prototype);
      },
      async create(params) {
        created.push(params);
        return { stop_reason: "end_turn", content: [{ type: "text", text: '```json\n{"scores":[{"id":"a1","score":7}]}\n```' }] };
      },
    },
  };
  const ai = createClaudeAi({ client });
  assert.equal((await ai.score([{ id: "a1", sourceName: "X", title: "T", snippet: "S" }])).get("a1"), 7);
  assert.equal((await ai.score([{ id: "a1", sourceName: "X", title: "T", snippet: "S" }])).get("a1"), 7);
  assert.equal(parseCalls, 1, "after the first refusal it goes straight to plain JSON");
  assert.match(created[0].system, /Reply with only one JSON object/);
  assert.equal(created[0].output_config, undefined);
});

test("no-AI mode: rules score, group and categorize; summaries are left for the editor", async () => {
  const { createRulesAi, ruleScore, sameNews, ruleTopic } = await import("../lib/rules.js");
  assert.equal(ruleScore({ title: "Flood alert issued in Agartala as Haora river rises" }), 9);
  assert.equal(ruleScore({ title: "Tripura cabinet approves new scheme" }), 9);
  assert.equal(ruleScore({ title: "আগরতলায় নতুন সেতুর উদ্বোধন" }), 8);
  assert.equal(ruleScore({ title: "Meghalaya to hold village council polls" }), 8);
  assert.equal(ruleScore({ title: "Malabar Gold hosts jewellery show in Hyderabad", snippet: "Tripura Star News" }), 3);
  assert.ok(ruleScore({ title: "Stock market closes higher" }) < 6);
  assert.ok(!sameNews("Udaipur in Rajasthan votes", "Tripura budget session begins"));
  assert.ok(sameNews("Tripura budget session begins on Monday", "Budget session of Tripura assembly begins Monday"));
  assert.equal(ruleTopic("BJP and Congress clash in assembly over election", ["Politics", "Education", "Sports"]), "Politics");
  assert.equal(ruleTopic("TBSE board results: students celebrate", ["Politics", "Education", "Sports"]), "Education");

  reset();
  const feed = [
    article(50, "Tripura Times", "Tripura budget session begins on Monday"),
    article(51, "EastMojo", "Budget session of Tripura assembly begins Monday"),
    article(52, "Syllad", "Film trailer launched in Mumbai"),
  ];
  const run = await runPipeline({ db, ai: createRulesAi({ topics: ["Politics"] }), sources: [], settings, fetchFeeds: async () => ({ articles: feed, okCount: 1, failed: [] }), log: quiet });
  assert.equal(run.practice_mode, true);
  const [story] = await db.listStories({ status: "pending" });
  assert.equal(run.stories_created, 1);
  assert.equal(story.summary, "", "summary left for the editor");
  assert.equal(story.region, "Tripura");
  assert.equal(story.topic, "Politics");
  assert.equal(story.sources.length, 2);

  // Even with auto-publish on, a story without a summary never goes live.
  reset();
  await runPipeline({ db, ai: createRulesAi(), sources: [], settings: { ...settings, autoPublish: { enabled: true } }, trusted: new Set(["Tripura Times", "EastMojo"]), fetchFeeds: async () => ({ articles: feed, okCount: 1, failed: [] }), log: quiet });
  assert.equal((await db.listStories({ status: "approved" })).length, 0);
});

test("no-AI mode: local stories from Tripura papers count as Tripura news", async () => {
  const { ruleScore } = await import("../lib/rules.js");
  assert.equal(ruleScore({ title: "Pistol recovered during police checking; tension in Boxanagar" }), 8);
  assert.equal(ruleScore({ title: "Usha Bazar murder case: accused dies in hospital", sourceRegion: "Tripura" }), 7);
  assert.ok(ruleScore({ title: "Rajasthan: voting begins in gram panchayats", sourceRegion: "Tripura" }) < 6);
  assert.ok(ruleScore({ title: "Usha Bazar murder case: accused dies in hospital", sourceRegion: "Northeast" }) < 6);
});

test("no-AI mode: differently worded reports from the same place are grouped; national news from Tripura papers is not kept", async () => {
  const { sameNews, ruleScore } = await import("../lib/rules.js");
  assert.ok(sameNews("Pistol seized from car during police search in Boxanagar", "Pistol Recovered from Vehicle During Police Checking ; Tension in Boxanagar"));
  assert.ok(!sameNews("Police seize drugs in Agartala", "Agartala police hold road safety rally"));
  assert.ok(ruleScore({ title: "2nd ODI: Preparation brings clarity, says Tejal Hasabnis", sourceRegion: "Tripura" }) < 6);
  // Big national news (here: the Prime Minister) is kept, but as "India" news, not Tripura news.
  assert.ok(ruleScore({ title: "প্রধানমন্ত্রী মোদিকে নিয়ে খার্গের মন্তব্যে বিতর্ক", sourceRegion: "Tripura" }) >= 6);
});

test("stories are filed under one of the eight states, or Northeast when several are involved", async () => {
  const { ruleRegion } = await import("../lib/rules.js");
  const { sectionFilter, categoryFromSlug } = await import("../lib/config.js");
  assert.equal(ruleRegion([{ title: "Guwahati traffic rules changed" }]), "Assam");
  assert.equal(ruleRegion([{ title: "Gangtok landslide blocks highway" }]), "Sikkim");
  assert.equal(ruleRegion([{ title: "Meghalaya, Assam border talks resume" }]), "Northeast");
  assert.equal(ruleRegion([{ title: "Murder accused dies in hospital", sourceRegion: "Tripura" }]), "Tripura");
  assert.equal(ruleRegion([{ title: "Seven Sisters tourism push" }]), "Northeast");
  assert.equal(sectionFilter("Northeast").regionIn.length, 9);
  assert.deepEqual(sectionFilter("Arunachal Pradesh"), { region: "Arunachal Pradesh" });
  assert.deepEqual(sectionFilter("Sports"), { topic: "Sports" });
  assert.equal(categoryFromSlug("arunachal-pradesh"), "Arunachal Pradesh");
});

test("national and world news: only big stories, filed under India or World, and capped per run", async () => {
  const { ruleScore, ruleRegion } = await import("../lib/rules.js");
  const { sectionFilter } = await import("../lib/config.js");
  assert.ok(ruleScore({ title: "Supreme Court strikes down electoral bonds law" }) >= 6);
  assert.ok(ruleScore({ title: "Mumbai traffic jam on Monday" }) < 6);
  assert.ok(ruleScore({ title: "South Korea migrant population rises", sourceRegion: "Tripura" }) < 6);
  assert.equal(ruleRegion([{ title: "Supreme Court strikes down electoral bonds law" }]), "India");
  assert.equal(ruleRegion([{ title: "Earthquake hits Nepal" }]), "World");
  assert.equal(ruleRegion([{ title: "Kim Jong-un visit may restart talks, says South Korea", sourceRegion: "Tripura" }]), "World");
  assert.deepEqual(sectionFilter("Northeast").regionIn.includes("India"), false);
  assert.deepEqual(sectionFilter("World"), { region: "World" });

  reset();
  const big = [
    "Supreme Court strikes down electoral bonds law",
    "Earthquake shakes Nepal capital overnight",
    "Parliament passes new telecom bill",
    "RBI keeps interest rates unchanged",
    "ISRO launches weather satellite",
  ].map((t, i) => article(60 + i, "Nagaland Post", t));
  const ne = [article(70, "Tripura Times", "Flood alert in Agartala")];
  const { createRulesAi } = await import("../lib/rules.js");
  const run = await runPipeline({ db, ai: createRulesAi(), sources: [], settings: { ...settings, maxOutsideNortheastPerRun: 2 }, fetchFeeds: async () => ({ articles: [...big, ...ne], okCount: 1, failed: [] }), log: quiet });
  assert.equal(run.articles_kept, 3, "2 national + 1 Northeast");
  const regions = (await db.listStories({ status: "pending" })).map((s) => s.region).sort();
  assert.equal(regions.length, 3);
  assert.ok(regions.includes("Tripura"));
});
