# InsightNE News: notes for Claude Code sessions

A Next.js news website for Tripura and Northeast India, deployed on Vercel from the `main` branch (merging to `main` publishes the site). The owner is a journalist and PhD researcher: write plain, clear English and explain changes without jargon.

## Working on this repository

- Tests: `npm test` (Node's built-in test runner, `tests/*.test.js`). All tests should pass, including without internet access.
- Build: `npx next build`. Three "Dynamic filesystem access" warnings from the News Hunter's local database are expected.
- Run locally without real services: `ADMIN_PASSWORD=… SESSION_SECRET=<32+ chars> LOCAL_DB_FILE=<file> npx next start`. The admin panel is at `/admin`.
- Publishing: commit to a branch, open a pull request, and merge it only when the owner says to publish.

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

The owner's own tool for their PhD thesis in journalism and mass communication: AI-text check, writing suggestions and an academic editor. Guide and results: `docs/10-THESIS-AI-TOOLS.md`.

| What | Where |
|---|---|
| Admin page (admin role only, not editors) | `app/admin/thesis-check/` |
| Thesis reading (.docx, paragraphs, quotations, citations, references), suggestions, voice profile | `public/ai-tools/academic.js` |
| Academic model (generated) and its data files | `public/ai-tools/model-academic.js`, `academic-words.js` (Kobak et al. 2025 excess words), `academic-norms.js` |
| Academic editor (AI rewrite, server side) | `lib/academic-editor.js` |
| Corpus, training, word list, norms, offline file | `scripts/thesis-*.js`, `scripts/thesis-checker.template.html` |

Rules for the academic editor (keep them when changing `ACADEMIC_SYSTEM`): never add a fact, figure, source or citation, and never complete a reference; keep every citation, quotation, number and technical term exactly; never make a claim stronger or weaker; keep the writer's person ("I", "we", "the researcher") and spelling. `integrityNotes()` checks citations, quotations, figures and paragraph count after every edit. The news house style (`WRITING_RULES`) is deliberately **not** used here: it is for news copy ("said", datelines). Only the checker's `SAFE_REPLACEMENTS` are applied, outside quotations and citations. The thesis text is never stored on the website.

## Open items

- **Thesis checker, next steps:** (1) add huggingface.co, arxiv.org, export.arxiv.org, api.openalex.org and shodhganga.inflibnet.ac.in to the environment's allowed domains, then add pre-2022 journalism and mass communication abstracts and Indian PhD theses as human text; (2) AI texts from current models (GPT-5, Claude, Gemini) in the owner's field, through an API key; (3) calibrate on the owner's own pre-2022 writing. See `docs/10-THESIS-AI-TOOLS.md`.

- **Second newsroom study:** read Reuters, AP, PTI, BBC, Guardian, The Hindu, Wikipedia and trust.org directly once they are added to the environment's allowed network domains. Fill in the "unconfirmed" points in `docs/9-NEWS-WRITING-STANDARDS.md`.
- **Gemini training:** 77 Gemini-app texts were collected; detection went from 44% to 58% (`docs/ai-text-gemini-eval.json`). The next step is about 1,200 texts through the API: `scripts/ai-text-gemini.js` with `GEMINI_API_KEY` set as an environment variable.
- **Editing quality:** the Vercel setting `CLAUDE_EDITOR_MODEL` (for example `claude-sonnet-5-5`) gives the senior editor a stronger model than the daily summaries use.
- The single-file offline checker for the owner's PC is built with `node scripts/ai-text-standalone.js ai-text-checker.html`. It has no senior editor, because that needs the site's AI key.
