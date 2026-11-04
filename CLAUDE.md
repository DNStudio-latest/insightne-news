# InsightNE News: notes for Claude Code sessions

A Next.js news website for Tripura and Northeast India, deployed on Vercel from the `main` branch (merging to `main` publishes the site). The owner is a journalist and PhD researcher: write plain, clear English and explain changes without jargon.

## Working on this repository

- Tests: `npm test` (Node's built-in test runner, `tests/*.test.js`). One test, "on GitHub, government pages go through the website's Mumbai server…" in `tests/hunter.test.js`, already fails on `main`. It is unrelated to the AI tools; do not treat it as a regression.
- Build: `npx next build`. Three "Dynamic filesystem access" warnings from the News Hunter's local database are expected.
- Run locally without real services: `ADMIN_PASSWORD=… SESSION_SECRET=<32+ chars> LOCAL_DB_FILE=<file> npx next start`. The admin panel is at `/admin`.
- Publishing: commit to a branch, open a pull request, and merge it only when the owner says to publish.

## AI checker and senior news editor (built November 2026)

| What | Where |
|---|---|
| Public AI-text checker (runs in the browser) | `public/ai-tools/` (`index.html`, `engine.js`, trained `model.js`) |
| Admin AI checker (side-by-side boxes, "What changed", headlines and intro) | `app/admin/ai-check/` |
| Senior news editor (the AI rewrite, server side) | `lib/news-editor.js`; length targets in `lib/editor-lengths.js` |
| Teach the AI (desk lessons for the editor, summaries, research drafts and checker) | `app/admin/ai-lessons/`, `lib/ai-lessons.js`, `lib/ai-lessons-store.js` |
| Training, corpus and evaluation scripts | `scripts/ai-text-*.js` |
| Guides | `docs/8-AI-TEXT-TOOLS.md` (tools, results), `docs/9-NEWS-WRITING-STANDARDS.md` (the newsroom study behind the editor) |

**House rules the owner has set for the senior editor.** They are already in `EDITOR_SYSTEM`; keep them when changing it:

- Never add a fact. Anything missing becomes an editor's note. Figures that appear only in the edit are flagged automatically.
- Dateline house style: `Agartala, Nov 4:`, with the place in normal capitals (`houseDateline()` enforces this). Keep the reporter's dateline and never add one.
- Do not write "occurred". Rebuild the sentence around who did what, when and where; use "was held" or "took place" for planned events.
- No ", prompting…" / ", leading to…" / ", resulting in…" result clauses: one event per sentence, in time order, with any cause attributed.
- Use "said" for attribution, not "stated", "informed", "opined" or "added further". Allegations stay allegations. Follow the Press Council of India norms on victims, relatives, caste and confessions.
- Headline set: main headline of 55–70 characters with key words first, short headline of 30–45 characters, two alternatives, and a one-sentence present-tense intro of 20–30 words.
- `AI_PHRASES` in `engine.js` is one of the trained model's features: do not edit it without retraining. Add editing advice to `PHRASE_ADVICE` or `PATTERNS` instead.

The owner reviews live edits and reports phrases that sound machine-written. Simple phrase corrections can now be made by the desk itself in **Admin → 🧠 Teach the AI** (`/admin/ai-lessons`, `lib/ai-lessons.js`): an approved lesson is added to the instructions of the senior editor, the daily summaries and the Research desk, and flagged in the admin checker, with no code change. Lessons are stored in the `ai_lessons` site setting; staff lessons wait for the admin's approval. Reports that need more than a phrase swap (a structural rule, like the ", prompting…" rule) still become a rule in `EDITOR_SYSTEM` (with the real example as a before/after), a `PATTERNS` entry in `engine.js` where a rule-based flag helps, and a test.

## Open items

- **Second newsroom study:** read Reuters, AP, PTI, BBC, Guardian, The Hindu, Wikipedia and trust.org directly once they are added to the environment's allowed network domains. Fill in the "unconfirmed" points in `docs/9-NEWS-WRITING-STANDARDS.md`.
- **Gemini training:** 77 Gemini-app texts were collected; detection went from 44% to 58% (`docs/ai-text-gemini-eval.json`). The next step is about 1,200 texts through the API: `scripts/ai-text-gemini.js` with `GEMINI_API_KEY` set as an environment variable.
- **Editing quality:** the Vercel setting `CLAUDE_EDITOR_MODEL` (for example `claude-sonnet-5-5`) gives the senior editor a stronger model than the daily summaries use.
- The single-file offline checker for the owner's PC is built with `node scripts/ai-text-standalone.js ai-text-checker.html`. It has no senior editor, because that needs the site's AI key.
