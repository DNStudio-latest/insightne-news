# InsightNE News: notes for Claude Code sessions

A Next.js news website for Tripura and Northeast India, deployed on Vercel from the `main` branch (merging to `main` publishes the site). The owner is a journalist and PhD researcher: write plain, clear English and explain changes without jargon.

## Working on this repository

- Tests: `npm test` (Node's built-in test runner, `tests/*.test.js`). All tests should pass, including without internet access.
- Build: `npx next build`. Three "Dynamic filesystem access" warnings from the News Hunter's local database are expected.
- Run locally without real services: `ADMIN_PASSWORD=… SESSION_SECRET=<32+ chars> LOCAL_DB_FILE=<file> npx next start`. The admin panel is at `/admin`.
- Publishing: commit to a branch, open a pull request, and merge it only when the owner says to publish.

## Language addresses, page caching and photo sizes (built November 2026)

- **Addresses:** every public page lives in `app/[lang]/`. English stays at the plain address (`/story/x`); other languages have a prefix (`/bn/story/x`). `proxy.js` serves plain addresses from `/en/…` without changing the address bar, redirects `/en/…` to the plain address, and sends a reader whose `lang` cookie says another language to that language's address. The rules are in `lib/lang-routing.js` (tested); helpers in `lib/languages.js` (`langPath`, `splitLangPath`, `INDEXED_LANGUAGES`).
- **Language in pages:** comes from the address (`params.lang`), never from cookies or headers, so pages can be cached. Use `href()` from `lib/lang.js` (or `storyUrl` / `categoryUrl`) for every internal link.
- **Search engines:** only `INDEXED_LANGUAGES` (English, Bengali) are indexed; the others are `noindex` until their translations are reviewed. A Bengali story without Bengali text is `noindex` with an English canonical. hreflang comes from `lib/seo.js`; the sitemap lists both versions.
- **Caching:** pages with `export const revalidate = 60` (and `generateStaticParams` returning `[]`) are kept ready for a minute; publishing calls `revalidatePath("/[lang]", "layout")`. Category, Originals, Search and Newsletter stay dynamic because they read `searchParams`. Never call `cookies()` or `headers()` in public pages: it switches caching off for them.
- **Matcher backslash:** `proxy.js`'s matcher must contain `\\..*` exactly as written in the file (two backslashes: an escaped dot). Shell heredocs drop the backslash; a test reads the matcher and fails if that happens.
- **Photos:** `savePhoto()` in `lib/photo.js` stores `<id>.w1600.webp` and `<id>.w640.webp`; `responsiveImage()` in `lib/photo-url.js` adds `srcset` only for such photos. AI illustrations are now converted to WebP too.
- **Layouts:** there is no `app/layout.js`: `app/[lang]/layout.js` and `app/admin/layout.js` are the two root layouts (fonts in `app/fonts.js`, metadata in `app/site-metadata.js`).

## Brief fact check and brief length (built November 2026)

- `lib/fact-check.js` (`checkSummaryFacts`) compares each AI-written brief with its sources (headlines, snippets and the news site's name): figures (digits, number words, "15 thousand", "3 lakh"), months, quotations and names in the summary (not the headline: Title Case) must appear in the sources. Names are skipped when the sources are mostly Bengali; abbreviations spelled out in the brief count as found when the abbreviation is in the sources. Reasons go into `check_reasons` and set `needs_check`, which blocks auto-publish. Wired into both paths in `lib/pipeline.js` (new briefs and `fillMissingSummaries`). Tests: `tests/fact-check.test.js`.
- Measured on 300 real recent briefs (read-only): 10% flagged; most flags were real additions by the AI (a first name, a month, a figure the sources do not give). If it flags too much, add words to `COMMON` in the file rather than loosening the checks.
- `SUMMARY_SYSTEM` (lib/ai.js) allows up to 90 words when two or more sources each add facts (70 for one source), never more than the sources say. The sources are only a headline and about 400 characters of snippet each: do not fetch publishers' full articles (copyright; the site's promise is short summaries in our own words).

- **Lesson suggestions:** `lib/lesson-suggestions.js` notes phrase swaps made when the desk edits AI briefs (`saveEdit` in `app/admin/actions.js`) and offers swaps seen twice on `/admin/ai-lessons`; the admin adds or dismisses. Never throws (a failure must not block a save).

## AI checker and senior news editor (built November 2026)

| What | Where |
|---|---|
| Public AI-text checker (runs in the browser) | `public/ai-tools/` (`index.html`, `engine.js`, trained `model.js`) |
| Admin AI checker (side-by-side boxes, "What changed", headlines and intro) | `app/admin/ai-check/` |
| Senior news editor (the AI rewrite, server side) | `lib/news-editor.js`; length targets in `lib/editor-lengths.js` |
| Shared house style (editor's writing rules + automatic corrections for every AI tool) | `lib/house-style.js` |
| Teach the AI (desk lessons for the editor, summaries, Research desk and News Hunter drafts, and checker) | `app/admin/ai-lessons/`, `lib/ai-lessons.js`, `lib/ai-lessons-store.js` |
| Training, corpus and evaluation scripts | `scripts/ai-text-*.js` |
| Guides | `docs/8-AI-TEXT-TOOLS.md` (tools, results), `docs/9-NEWS-WRITING-STANDARDS.md` (the newsroom study behind the editor) |

**House style on every AI tool (owner's instruction, November 2026).** The senior editor's writing rules (`WRITING_RULES` in `lib/house-style.js`, included in `EDITOR_SYSTEM`) are also given to the daily summaries and to the Research desk and News Hunter drafts. The AI checker's `SAFE_REPLACEMENTS` are applied to every AI answer, never inside quotation marks. A new AI tool that writes for the website must use both. Do not apply them to translations or to the Gemini training texts.

**House rules the owner has set for the senior editor.** They are already in `EDITOR_SYSTEM` (the writing rules through `lib/house-style.js`); keep them when changing it:

- Never add a fact. Anything missing becomes an editor's note. Figures that appear only in the edit are flagged automatically.
- Dateline house style: `Agartala, Nov 4:`, with the place in normal capitals (`houseDateline()` enforces this). Keep the reporter's dateline and never add one.
- Do not write "occurred". Rebuild the sentence around who did what, when and where; use "was held" or "took place" for planned events.
- No ", prompting…" / ", leading to…" / ", resulting in…" result clauses: one event per sentence, in time order, with any cause attributed.
- Use "said" for attribution, not "stated", "informed", "opined" or "added further". Allegations stay allegations. Follow the Press Council of India norms on victims, relatives, caste and confessions.
- Headline set: main headline of 55–70 characters with key words first, short headline of 30–45 characters, two alternatives, and a one-sentence present-tense intro of 20–30 words.
- `AI_PHRASES` in `engine.js` is one of the trained model's features: do not edit it without retraining. Add editing advice to `PHRASE_ADVICE` or `PATTERNS` instead.

The owner reviews live edits and reports phrases that sound machine-written. Simple phrase corrections can now be made by the desk itself in **Admin → 🧠 Teach the AI** (`/admin/ai-lessons`, `lib/ai-lessons.js`): an approved lesson is added to the instructions of the senior editor, the daily summaries and the drafts writer (Research desk and News Hunter), and flagged in the admin checker, with no code change. A News Hunter draft that still uses a banned phrase gets the `lesson` flag and is never auto-published. Lessons are stored in the `ai_lessons` site setting; staff lessons wait for the admin's approval. Reports that need more than a phrase swap (a structural rule, like the ", prompting…" rule) still become a rule in `EDITOR_SYSTEM` (with the real example as a before/after), a `PATTERNS` entry in `engine.js` where a rule-based flag helps, and a test.

## PhD thesis checker (built November 2026, admin only)

The owner's own tool for their PhD thesis in journalism and mass communication: writing suggestions and a ChatGPT-style signal. **No AI may be used to edit the owner's thesis text** (owner's instruction, November 2026): the AI "academic editor" was removed (see PR #15 in git history if it is ever wanted again, and only if the owner asks); everything runs in the browser and no thesis text is sent anywhere. **It is a writing aid, not a verdict** (owner's decision, November 2026): tests showed it cannot detect text from current AI assistants, so labels say "ChatGPT-style signal" / "No ChatGPT-style signal found", never "human-written", and `DETECTION_LIMIT` is shown with every score. Keep it that way unless a new method is shown to work on the owner's test set. Guide and results: `docs/10-THESIS-AI-TOOLS.md`.

| What | Where |
|---|---|
| Admin page (admin role only, not editors) | `app/admin/thesis-check/` |
| Thesis reading (.docx, paragraphs, quotations, citations, references), suggestions, voice profile | `public/ai-tools/academic.js` |
| Academic model (generated) and its data files | `public/ai-tools/model-academic.js`, `academic-words.js` (Kobak et al. 2025 excess words), `academic-norms.js` |
| Corpus, training, word list, norms, offline file | `scripts/thesis-*.js`, `scripts/thesis-checker.template.html` |

Replacements offered by the checker are fixed rules the owner chooses; none is made by an AI. Only the checker's `SAFE_REPLACEMENTS` are used. The thesis text is never stored on the website.

## Ask InsightNE chat box (built November 2026)

- A 💬 button at the bottom-right of every public page (`ReaderChat` in `app/client.js`, mounted in `PageShell`). Answers come from `app/api/chat/route.js` → `lib/reader-chat.js` (tests: `tests/reader-chat.test.js`).
- The AI answers **only** from published stories found by `findStories()` (search words from the question plus the latest stories) and the site's own details (contact, tips, corrections, grievance, advertising). It must never answer from its own knowledge, gives no political opinions, cites stories as [n], and the stories are shown as links under the answer. `CHAT_SYSTEM` includes the house style; answers pass through `houseText()`.
- **Which AI (owner's choice, November 2026):** the free Gemini key (`GEMINI_API_KEY`) is used first when the site has one; `CHAT_PROVIDER=claude` switches to Claude (`ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY`). `chatProvider()` in `lib/reader-chat.js` decides. Gemini is called with no waiting and one retry only, so a visitor never waits minutes when Google's free limit is reached; the route then shows a "busy" message. `GEMINI_CHAT_MODEL` and `CLAUDE_CHAT_MODEL` set other models. On Google's free tier, Google may use submitted text to improve its products: the privacy page names Google Gemini.
- Chats are not stored (the privacy page says so). Limits: 15 questions per visitor per 10 minutes and `CHAT_DAILY_LIMIT` for the whole site per day (default 400 with Gemini, 1500 with Claude).
- Switch off with `"readerChat": { "enabled": false }` in `settings.json`; it is also hidden when there is no AI key.

## Open items

- **Thesis checker, next steps:** (1) add huggingface.co, arxiv.org, export.arxiv.org, api.openalex.org and shodhganga.inflibnet.ac.in to the environment's allowed domains, then add pre-2022 journalism and mass communication abstracts and Indian PhD theses as human text; (2) AI texts from current models (GPT-5, Claude, Gemini) in the owner's field, through an API key; (3) calibrate on the owner's own pre-2022 writing. See `docs/10-THESIS-AI-TOOLS.md`.

- **Second newsroom study:** read Reuters, AP, PTI, BBC, Guardian, The Hindu, Wikipedia and trust.org directly once they are added to the environment's allowed network domains. Fill in the "unconfirmed" points in `docs/9-NEWS-WRITING-STANDARDS.md`.
- **Gemini training:** 77 Gemini-app texts were collected; detection went from 44% to 58% (`docs/ai-text-gemini-eval.json`). The next step is about 1,200 texts through the API: `scripts/ai-text-gemini.js` with `GEMINI_API_KEY` set as an environment variable.
- **Editing quality:** the Vercel setting `CLAUDE_EDITOR_MODEL` (for example `claude-sonnet-5-5`) gives the senior editor a stronger model than the daily summaries use.
- The single-file offline checker for the owner's PC is built with `node scripts/ai-text-standalone.js ai-text-checker.html`. It has no senior editor, because that needs the site's AI key.
