# Plan: language-specific web addresses

**Status (12 Nov 2026):** built on branch `claude/language-addresses`, not yet published. All six languages have addresses; English and Bengali are offered to search engines, the others are `noindex` until reviewed. Details in `CLAUDE.md`.

## Why
Today a reader's language is chosen by a saved setting in the browser, on the same web address.
Google sees only the English pages, so Bengali, Hindi, Assamese and Nepali readers can't find our pages in search.
Giving each language its own address (for example /bn/story/...) lets Google index each language.

## What would change
1. Routes: every page gets a language prefix (English stays at the current address, others at /bn/, /hi/, /as/, /ne/).
2. Links: menus, story links and the language switch build addresses with the prefix.
3. Language tags: each page declares its language and links to its matching pages in other languages (hreflang).
4. Sitemap: lists every language version of each page.
5. Language switch: the link goes to the same page in the other language, instead of setting a cookie.

## Risks
- Old links and WhatsApp short links must keep working (redirects from the old addresses).
- Google may take weeks to re-index; some search rankings may dip briefly.
- Translated pages are created automatically from English, so they must be checked before they are indexed.

## Order of steps
1. Agree the address pattern (for example /bn/ or /bn-IN/).
2. Build the routes and links on a separate branch, not on main.
3. Add redirects for the old links and test them.
4. Add language tags and the language-aware sitemap.
5. Check on a preview site, then review together.
6. Only then publish to the live site.

## Decisions needed from you
- Which languages get their own addresses (all five, or Bengali first)?
- Keep English at the current address? (Recommended: yes.)
