# Growth audit: InsightNE News (12 November 2026)

An audit of the live website and the code, with recommendations in priority order. Nothing in the site was changed for this audit.

## What was checked, and what was not

**Checked:** the live pages (home, a story, Originals, Today, Videos, Tripura category, RSS feed, both sitemaps, robots.txt), response times and headers from the main PC, the page code for search tags and images, `settings.json`, and the AI tool code (`lib/ai.js`, `lib/gemini.js`, `lib/news-editor.js`, `lib/house-style.js`, `lib/hunter/`).

**Not checked:** Google Search Console data, visitor numbers, phone speed scores (Core Web Vitals) and the Supabase database. The Supabase connector was offline in this session. Reader numbers would sharpen every recommendation below.

## Findings

| # | Finding | Evidence |
|---|---|---|
| 1 | Every page is built fresh for every visitor; nothing is cached | Header `Cache-Control: private, no-cache, no-store`; `X-Vercel-Cache: MISS`; every public page has `force-dynamic`; the layout reads the language cookie |
| 2 | Pages are slow to start | Time to first byte from Agartala: home 1.9 s, Today 3.5 s, others 0.8–1.3 s. A cached page normally answers in under 0.2 s |
| 3 | Photos are not sized for phones | No `srcset` on any image; only 5 of 22 homepage images declare width and height; one story photo is a 436 KB JPEG, others 27–114 KB WebP |
| 4 | Most stories are very short briefs | The sampled brief has about 40 words of news text. In the RSS feed, 21 of 50 items are original reports; 29 are briefs |
| 5 | Most homepage pictures are AI illustrations | 16 "AI illustration" labels on 22 homepage images |
| 6 | Languages share one address | Language is chosen by cookie, so Google sees only English. No `hreflang` tags. `docs/PLAN-language-addresses.md` is still undecided |
| 7 | Briefs are published without a person checking | `autoPublish.enabled: true`, `minScore: 8` |
| 8 | The AI tools run on the lowest-cost models | Summaries and the senior editor default to Claude Haiku 5.5 or Gemini Flash Lite; `CLAUDE_EDITOR_MODEL` is an open item in `CLAUDE.md` |
| 9 | The editor's name is hidden | `publisher.showEditorName: false`; bylines read "InsightNE News Desk" |
| 10 | The basics are sound | Valid news sitemap (49 stories in 3 days), 630 stories in the sitemap, NewsArticle and NewsMediaOrganization data, canonical tags, security headers, policy pages, RSS |

## Recommendations, in order

### 1. Make the site fast (largest gain for the least risk)
- Cache public pages for 1–5 minutes and refresh them when a story is published. The site already has the refresh code (`lib/site-cache.js`); the pages do not use it because of `force-dynamic` and the language cookie.
- This depends on item 3 below: language must move from the cookie into the address before pages can be cached safely.
- Serve photos in phone sizes (`srcset`), declare width and height on every image, and convert the remaining large JPEGs to WebP.

### 2. Publish fewer, fuller stories
- Lengthen briefs from about 40 words to 80–120: what happened, who said it, why it matters to readers in the Northeast, what happens next. Use only facts in the sources.
- Merge several sources on the same event into one brief with all sources credited.
- Raise the share of original reports. They are what Google ranks, what readers share, and what an ad network looks for.
- Use AI illustrations less. Prefer a real photo, an official handout with credit, a map or a data card. A story with no picture is better than a homepage that is mostly illustrations.

### 3. Give each language its own address
- `/bn/…`, `/hi/…`, `/as/…`, `/ne/…`, `/trp/…` with `hreflang` tags, so Google can index and rank each version. Bengali first is the lowest-risk start; it is also the largest audience in Tripura.
- This also unlocks caching (item 1).

### 4. Build pages readers return to
- Topic pages for people, places and running stories (for example the Tripura civic polls), each listing every related story with a short timeline.
- "Related stories" under every story, chosen by topic and place.
- An election hub for the civic polls: schedule, candidates by ward, results on the day.

### 5. Grow the audience outside Google
- Check Google Search Console and apply to Google News Publisher Center (owner's task; needs the owner's Google account).
- Daily WhatsApp channel post, the daily email and push alerts already exist: add a sign-up prompt after the second paragraph of each story.
- Short vertical videos from the existing YouTube work, each linked to the story page.

### 6. Trust
- Decide whether to show the editor's name. Named journalists are a ranking and trust signal; hiding the name is the owner's choice and may have good reasons.
- Add "How we use AI" to the editorial policy: what AI writes, what a person checks, how illustrations are labelled.
- Review auto-publish: either raise the bar or have a second AI check (below) before anything goes live without a person.

## The AI tools: what a stronger model can do

| Tool | Now | Proposed |
|---|---|---|
| Senior news editor | Lowest-cost model | Set `CLAUDE_EDITOR_MODEL` to a stronger Claude model for editing only. Cost per edit rises; check the price before switching |
| Brief writer | About 40 words, one source | 80–120 words, several sources merged, a "why it matters" line, facts from sources only |
| Fact check before auto-publish | Rules only (score, flags) | A second pass that compares every name, number, date and quote in the draft with the source text and blocks auto-publish on any mismatch |
| Teach the AI | Desk types lessons by hand | Suggest lessons automatically from the difference between the AI draft and the version the editor published; the admin still approves each one |
| Headlines | One set per story | Record which headline style gets more views (the site already counts views) and feed the findings back as lessons |
| Running stories | Each brief stands alone | Group briefs on the same event into one developing story with a timeline |
| Translations | Automatic, unreviewed | A quality check on Bengali and Kokborok by a second pass, with the Kokborok editors' corrections saved as lessons |
| AI-text checker | Trained on 2023–24 models; weak on current ones | Finish the Gemini training (open item), add current Claude and GPT texts, and keep the "a score is not proof" notice |

**What is not possible:** the model cannot be "trained" on Reuters, AP, PTI or BBC copy. Their text is copyrighted. The tools can follow their published style rules and learn from this desk's own edits.

## About the goal

"Best news website in the world" is not a target a small desk can measure. A reachable target is: the fastest, most trusted news site for Tripura, in English and Bengali, within 6–12 months. Every item above serves that.

## Suggested order of work

1. Language addresses (Bengali first) with page caching and image sizing.
2. Fuller briefs and the fact-check pass.
3. Related stories and topic pages; the civic polls hub.
4. Stronger editor model and automatic lesson suggestions.
5. Checker retraining.
