# Security: what protects the website, and what to do once

## One-time steps (after the code is online)

1. **Supabase → SQL Editor → New query**: paste all of `supabase/security.sql`, press **Run**.
   - It makes the "too many tries" counters work across all servers (without it, counters are kept per server only).
   - It removes the public keys' default permissions on the News Hunter tables.
   - The last part lists every table. Each row must show `rls_on = true` and `public_access = false`.
2. **Optional, recommended: two-step sign-in for the admin.**
   - On your computer run `npm run totp-setup` and follow the screen: add the key to an authenticator app, then add
     `ADMIN_TOTP_SECRET` in Vercel → Settings → Environment Variables and redeploy.
   - Editors and sub-editors keep signing in with their password only.
   - Lost phone? Delete `ADMIN_TOTP_SECRET` in Vercel and redeploy: sign-in is back to password only.

## What is in place

| Protection | Where |
|---|---|
| Database queries never glue visitor text into SQL (only the search filter is built from text, and only letters, digits and spaces are allowed in it) | `lib/db.js` |
| Every admin action and page checks who is asking, on the server | `app/admin/*` |
| Sub-editors can only open and change their own stories | `app/admin/actions.js`, `app/admin/write/page.js` |
| Admin actions are Next.js server actions: same-origin check built in, plus a SameSite cookie | `lib/auth.js` |
| "Too many tries" limits: sign-in 10 per 15 min, newsletter 8 per hour, poll 40 per hour, phone alerts 20 per hour, Research desk 20 per hour | `lib/rate-limit.js` |
| Two-step sign-in (optional) | `lib/totp.js` |
| Photos: real JPG/PNG/WEBP only (checked by the file's first bytes), 80-megapixel limit, never stored as uploaded | `lib/photo.js` |
| Server-side fetching refuses private network addresses, including through redirects | `lib/safe-fetch.js` |
| Phone alerts only go to the browser makers' push services | `lib/push-hosts.js` |
| The language link only goes back to pages of this site | `lib/safe-redirect.js` |
| The Hunter's helper routes compare their password in constant time | `lib/tokens.js` |
| Safety headers (no framing, no type guessing, referrer, permissions, CSP basics) | `next.config.mjs` |
| No secrets in the code or the git history; browser files hold no secrets | checked 2 Nov 2026 |
| No browser source maps are published | checked 2 Nov 2026 |

## Good habits

- Editors sign in with a password only (no user name), so every password must be long (10+ characters), unique and never reused.
- Never paste keys or passwords in chats, emails or the GitHub repository (it is public).
- If a key might have leaked: make a new one in its service, update it in Vercel **and** GitHub secrets, redeploy.
- Run `npm audit` now and then, and update packages when it reports problems.
