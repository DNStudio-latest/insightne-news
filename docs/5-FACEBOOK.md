# Guide 5: Post stories to your Facebook page

The website can post a published story to your Facebook page (headline, summary, hashtags and the link;
Facebook adds the picture by itself). It stays **hidden** until you finish these steps. **Cost: free.**

You must be an **admin of the Facebook page**. Do this on a computer. Claude will guide you step by step;
never paste the tokens into chat.

## News posters (added November 2026)

When a story that has a photo is published, the site posts a **news poster** instead of a plain link: a 1920 × 1080 picture made from the story's own photo, with the headline, the place and date, one supporting line and up to three key points, all taken word for word from the story (nothing is written by an AI, so no fact can be invented). The story link is in the Facebook caption; on Instagram the poster is posted and the caption says "link in bio". The photo is only cropped and slightly brightened, never redrawn. A poster made from an AI illustration says "AI ILLUSTRATION". The website keeps the original photo.

- **See any poster:** on the approval page, under a published story, tap **VIEW POSTER** (or open `/poster/<story>`).
- **Switch on or off:** `poster.enabled` in `settings.json`. Off = the old way (link post; news card on Instagram).
- **Which stories:** `facebook.autoPost` and `instagram.autoPost` are `true` = every published story. `"originals"` = your own reports only.
- **Daily limit:** `poster.maxPerDay` (default 20 per network in 24 hours; Instagram allows 50). Stories over the limit are not posted and are listed on `/admin/social`; the POST button still works.
- English only: Bengali letters do not join correctly in these pictures.

## 1. Make a free Meta developer app
1. Go to **developers.facebook.com** → **Get started** (log in with the Facebook account that runs the page).
2. **My Apps → Create app** → name it `InsightNE Website` → use case **"Manage everything on your Page"**.
3. Leave the app in **Development** mode. That is enough for posting to your own page.

## 2. Get the page key (token)
1. Open **Graph API Explorer** (developers.facebook.com/tools/explorer).
2. Pick your app. Under **Permissions** add: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
3. Click **Generate Access Token** and choose your page.
4. Click the small **ⓘ** next to the token → **Open in Access Token Tool** → **Extend Access Token** → copy the new long token.
5. Back in the Explorer, paste that long token, type `me/accounts` in the box and click **Submit**.
6. In the answer, find your page. Copy its **id** and its **access_token** into Notepad.
   (This page token does not expire.)

## 3. Add 2 secret settings in Vercel
Vercel → project → **Settings → Environment Variables**:

| Name | Value |
| --- | --- |
| `FACEBOOK_PAGE_ID` | the page **id** |
| `FACEBOOK_PAGE_TOKEN` | the page **access_token** |

## 4. Database (one time)
Supabase → SQL Editor → paste the whole `supabase/schema.sql` → **Run** → "Success".
Then **Push** in GitHub Desktop (or Redeploy in Vercel).

## 5. Using it
- Each published story on `/admin` gets a **📘 POST TO FACEBOOK** button. A story can only be posted once.
- To post **every** story automatically when you tap APPROVE, change `"autoPost": false` to `true`
  in `settings.json` (ask Claude). Start with the button first to see how the posts look.
