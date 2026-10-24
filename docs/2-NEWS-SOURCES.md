# Guide 2 — Add or remove news sources

All your news sources are in **one file: `sources.json`**. You can edit it directly on the GitHub website —
no programs needed. Changes are used from the next collector run (within 3 hours).

## How to open the file on GitHub

1. Go to github.com → your `insightne-news` repository → click **sources.json**.
2. Click the **pencil ✏ icon** (Edit this file) at the top right.
3. Make your change (see below).
4. Click **Commit changes…** → **Commit changes**. Done.

## What one source looks like

```json
    {
      "name": "Tripura Times",
      "website": "https://tripuratimes.com",
      "feed": "https://tripuratimes.com/rss.xml",
      "enabled": true,
      "autoPublish": false
    },
```

| Line | Meaning |
|---|---|
| `name` | The name readers see under each story ("Source: Tripura Times") |
| `website` | The site's home page (for your reference) |
| `feed` | The RSS feed address — where the collector reads the latest headlines |
| `enabled` | `true` = collect from it. `false` = switched off |
| `autoPublish` | Keep `false`. Only matters if you switch on the future auto-publish option |

## Turn a source OFF (or back ON)

Change `"enabled": true` to `"enabled": false`. That's all. To turn it back on, change it back to `true`.
This is safer than deleting it.

## Add a new source

1. Find its RSS feed address (see below).
2. In `sources.json`, copy one whole block — from `{` to `},` — and paste it right below.
3. Change `name`, `website` and `feed`.

**Be careful with the punctuation:**
- Every block is wrapped in `{ }` and followed by a comma `,` — **except the very last block in the list, which has no comma.**
- Keep the double quote marks `" "` around text.
- `true` and `false` have **no** quote marks.

If you make a mistake, GitHub Actions will show a red ✗ on the next run. Open the file again and compare
it with the example above. (Or ask me to check it.)

## How to find a site's RSS feed

Try these, in order (replace `SITE.com` with the real address):

1. `https://SITE.com/feed` or `https://SITE.com/feed/` — works for most WordPress news sites
2. `https://SITE.com/rss` or `https://SITE.com/rss.xml`
3. Open the site, right-click → **View page source**, press **Ctrl+F**, search for `rss`. Look for a link ending in `.xml` or `/feed`.
4. Section feeds: many sites have one feed per section, e.g. `https://nenow.in/north-east/tripura/feed`.

**How to check a feed address works:** open it in your browser. If you see a page full of text with
`<item>` and `<title>` (or the browser shows a list of headlines), it is a feed. If you see a normal
webpage or "404 Not Found", it is not.

## Sources I checked for you (24 October 2026)

**Working and switched ON (17 feeds):** Tripura Times, Tripura Chronicle, Tripura Star News, Jagaran Tripura
(Bengali — Claude summarizes it in English), Northeast Now (main + Tripura section), EastMojo (main + Tripura
section), India Today NE, The Sentinel, Pratidin Time, Hub News, The Shillong Times, Syllad, Highland Post,
The Morung Express, Nagaland Post, The Frontier Manipur.

**In the file but switched OFF:**
- *Google News search: Tripura* — brings Tripura stories from many national papers (The Hindu, Indian Express, etc.), but you don't choose which papers. Switch on if you want wider coverage.
- *Imphal Free Press* — its feed has not updated since August 2026.

**Could not be added (no working feed found):**
- *Tripura Infoway* (tripurainfo.com) — no feed found.
- *Northeast Today* and *The Assam Tribune* — their sites block automatic readers.
- *Arunachal Times* — no feed found.
- *Northeast Live* — the site did not respond.

If you know other trusted sites, send me their names and I'll look for their feeds.

## The approval page tells you when a feed breaks

At the top of your approval page, "Last check" shows how many feeds worked. A broken feed is listed as
**"Feed not working: NAME"**. One broken feed never stops the others. If the same feed fails for several days,
the site probably changed its feed address — look for the new one (steps above) or switch it off.
