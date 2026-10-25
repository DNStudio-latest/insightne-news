# InsightNE News

A news website for Tripura and Northeast India. It **collects** news automatically, lets **Claude (AI)** pick
the important stories and write short summaries, and **waits for your approval** before anything is published.

## How it works

```
Every 3 hours (GitHub runs this for free)
  1. COLLECT    read the RSS feeds listed in sources.json
  2. SELECT     Claude Haiku scores each new article 1–10; keeps 6 and above
  3. ARRANGE    reports of the same event are grouped into one story with all sources
  4. SUMMARIZE  Claude writes a headline + 2–3 sentence summary in its own words
  5. FLAG       sensitive or doubtful stories get "NEEDS EXTRA CHECK"
  6. WAIT       every story goes to "Pending"

You, on your phone (/admin)
  APPROVE → appears on the website immediately   EDIT → change it   REJECT → never shown

Readers (the home page)
  newest approved stories · categories · source names and "Read full story" links · YouTube box
```

## The guides

| Guide | For |
|---|---|
| [docs/1-PUT-ONLINE.md](docs/1-PUT-ONLINE.md) | Putting the website on the internet (one time) |
| [docs/2-NEWS-SOURCES.md](docs/2-NEWS-SOURCES.md) | Adding, removing, or fixing news sources |
| [docs/3-APPROVAL-PAGE.md](docs/3-APPROVAL-PAGE.md) | Using your approval page every day |

## The files you may edit yourself

| File | What it controls |
|---|---|
| `sources.json` | The list of news sites (see Guide 2) |
| `settings.json` | Website name, tagline, YouTube link, categories, minimum score, cost limit, auto-publish switch |

### settings.json explained

| Setting | Meaning |
|---|---|
| `siteName`, `tagline` | Shown at the top of the website |
| `youtubeUrl`, `youtubeName` | The YouTube box on every page |
| `regions` | The two area categories: Tripura, Northeast. Every story gets one. |
| `topics` | Extra categories: Politics, Education, Sports. A story gets one, or none. |
| `minimumScore` | Stories below this score are dropped (now 6) |
| `onlyArticlesNewerThanHours` | Ignore articles older than this (now 48 hours) |
| `maxArticlesPerRun` | At most this many new articles are sent to Claude per run — a safety cap on cost (now 200) |
| `autoPublish.enabled` | **Future option, keep `false`.** See below. |

If you add a new topic (for example `"Health"`), Claude starts using it from the next run.

## Copyright rules built in

- Only our own headline, our own 2–3 sentence summary, and links are shown. No article text, no images.
- Every story names and links all its sources, plus a "Read full story" link to the original.
- Claude is told never to copy more than five words in a row. The system then **checks** each summary against
  the original: if 8 or more words in a row match, Claude is asked to rewrite it; if it still matches, the
  story is flagged so you can fix it.
- The website footer says that full articles belong to their publishers.

## Money and safety

- **Free:** GitHub, Supabase, Vercel (Hobby plan, for non-commercial sites).
- **Paid:** Claude Haiku (the lowest-cost Claude model), bought through **OpenRouter** with crypto, or directly from Anthropic. Expected cost: **about $1–3 a month**.
  Prepaid OpenRouter credit plus a $5 key limit caps spending (Guide 1, Step 3).
- Extra cost guard: at most 200 articles per run, and articles already checked are never sent to Claude again.
- All passwords and keys are kept in **secret settings** (Vercel and GitHub), never in the code.
  The file `.env.example` lists their names, with no values.
- If a feed breaks, it is skipped and listed on your approval page; the others continue.
- If Claude is unavailable (or the spending limit is reached), nothing breaks; the articles are tried again next run.

## Future option: auto-publish (switched OFF)

In `settings.json`, `"autoPublish": { "enabled": false }`. If you ever change it to `true`, a story is published
**without your approval** only when **all three** are true:
1. every source of that story has `"autoPublish": true` in `sources.json`, **and**
2. the story is **not** marked NEEDS EXTRA CHECK, **and**
3. the switch is on.

Everything else still waits in Pending. Auto-published stories are labelled "auto-published" in your Published tab.

## Trying it on your own computer (practice mode)

Without any accounts, the project runs in **practice mode**: stories are saved in `data/local-db.json`
and no AI is used (summaries are placeholders, which is free).

```
npm install
npm run collect      # collect news once
npm run build
npm start            # open http://localhost:3000 and http://localhost:3000/admin
npm test             # run the automatic checks
```

The practice password is in the file `.env.local` (this file stays on your computer and is never uploaded).

## For a developer (technical summary)

- Next.js 16 (App Router, JavaScript), server actions for approvals; `force-dynamic` pages so approvals show at once.
- Supabase Postgres via `@supabase/supabase-js` using the secret key on the server only; row-level security on,
  no public policies. Tables in `supabase/schema.sql`. Local JSON fallback in `lib/db.js`.
- Collector: `scripts/collect.js` → `lib/pipeline.js`; scheduled by `.github/workflows/collect.yml` (cron every 3 h).
- Claude: `lib/ai.js`, Anthropic SDK pointed at OpenRouter (`OPENROUTER_API_KEY`, model `anthropic/claude-haiku-5.5`) or Anthropic (`ANTHROPIC_API_KEY`, `claude-haiku-5-5`); `effort: "low"`,
  structured outputs via `zodOutputFormat`.
- Admin auth: `ADMIN_PASSWORD` + HMAC-signed httpOnly cookie (`SESSION_SECRET`), 30 days.
- Tests: `npm test` (node:test; no network or AI cost).
