# Guide 3 — Using your approval page

Your approval page is at **`https://YOUR-ADDRESS/admin`**. Only someone with your password can open it.
It is made for your phone. Tip: open it once and choose **Add to Home Screen**.

**Nothing appears on the public website until you approve it.**

## The top of the page

- **Pending (number)** — stories waiting for you. The most important (highest score) are at the top.
- **Published** — stories that are on the website now.
- **Rejected** — stories you turned down.
- **View website ↗** — opens the public site.
- **Last check** — when the collector last ran, how many feeds worked, and any feed that is **not working**.

## Each story card shows

- **Score 8/10** — how important the story is for Tripura and Northeast readers, judged by Claude or, in no-AI mode, by simple rules (only 6 and above are shown).
- **Tripura / Northeast** and a topic such as **Politics** — where it will appear on the site.
- **⚠ NEEDS EXTRA CHECK** with reasons — see below.
- **Headline and summary** — written in our own words, not copied. (In no-AI mode you write the summary; see below.)
- **Sources** — every site that reported it. Tap one to open the original article. "Their headline" shows
  the original title so you can compare.

## The three buttons

| Button | What it does |
|---|---|
| **APPROVE** | Publishes it on the website **immediately**. |
| **EDIT** | Opens a box where you can change the headline, summary, state, topic and **add your own photo** (with caption and credit). Then press **SAVE** (keeps it pending) or **SAVE & APPROVE** (publishes it). |
| **REJECT** | Removes it from the list. It never appears on the site. (You can bring it back from the **Rejected** tab.) |

## No-AI mode: WRITE SUMMARY

While no Claude key is set, the website runs in **no-AI mode** (free). Simple rules pick and group the stories,
and each story arrives with **"✍ No summary yet"**. Instead of APPROVE you see **WRITE SUMMARY**:

1. Read the source. Tap its name to open the full article. "Their intro" shows the first lines from their feed
   (only you can see this).
2. Tap **WRITE SUMMARY**. Write **2–3 sentences in your own words**. Don't copy sentences from the source.
   You can also improve the headline and change the area or topic.
3. Tap **SAVE & APPROVE** to publish, or **SAVE** to finish it later.

A story without a summary can never be published, not even by the auto-publish option.
The "Last check" line at the top says **(no-AI mode)** while this mode is on. When a Claude key is added
(see Guide 1, Step 3), Claude writes the summaries again automatically.

## ⚠ NEEDS EXTRA CHECK

A story gets this warning when it may be unverified, rumour, sensational, or sensitive — violence, religion,
communities, elections, accidents, or crime involving named people. The system also adds this warning
when certain words appear (like "arrested", "killed", "election"), even if Claude did not, to be extra safe.
It also warns you if the summary seems to repeat the original's wording.

For these stories you must tick **"I have checked this story before approving"** before APPROVE works.

**Good habit for flagged stories:** open at least one source, check the facts and names, and use EDIT to make
the wording neutral ("police said…", "according to…") before approving.

## Made a mistake?

- **Published something by mistake:** go to **Published** → **UNPUBLISH**. It leaves the website at once and goes back to Pending.
- **Typo in a published story:** **Published** → **EDIT** → fix it → **SAVE**. The website updates at once.
- **Rejected by mistake:** **Rejected** → **TO PENDING**.

## How often should I check?

New stories arrive every 3 hours. Checking two or three times a day is enough. Stories you don't act on
simply stay in Pending.

## Signing out

Press **Sign out** at the top. If you don't, your phone stays signed in for 30 days.
To change your password: change `ADMIN_PASSWORD` in Vercel (Project → Settings → Environment Variables),
then **Deployments → ⋯ → Redeploy**.

## ✍ Writing your own story (InsightNE Originals)

Tap **✍ Write story** at the top of the approval page.

| Box | What to write |
|---|---|
| **Headline** | Clear and factual, about 8–14 words. |
| **Intro** | 1–2 sentences with the most important facts. Shown under the headline and on the front page. |
| **Story text** | The full report. Leave an **empty line** between paragraphs. Start a line with `## ` for a subheading, or `> ` for a quote. |
| **Photo** | Only **your own photos** (or ones you have permission for). Taken straight from your phone — it is made smaller automatically before uploading. |
| **Caption / credit** | What the photo shows, and who took it. |
| **Area / Topic** | Where the story appears on the site. |
| **Written by** | Your name, or "InsightNE News Desk". |
| **Make this the lead story** | Puts it big at the top of the front page (only one story is the lead at a time). |

Then tap **PUBLISH** (goes live immediately) or **SAVE DRAFT** (waits under Pending; tap **CONTINUE WRITING** to finish it later).
To change a published story: **Published** tab → **OPEN EDITOR** → change → **UPDATE**.

**Claude can draft stories for you.** In the Claude app, send your notes, quotes or a voice-note transcript and ask for a
draft. Claude saves it under **Pending** with the note "drafted by Claude". Open it, check every fact, then publish.

## The front page

- The **lead story** is the one you marked "Make this the lead story". If none is marked, it is your newest original
  report with a photo, otherwise the newest story.
- **LATEST** ticker, **Latest** list, **InsightNE Originals**, a block for each category and your **latest YouTube videos**
  are all filled in automatically.
- Readers who keep the page open see a **"New stories — tap to see"** button when you publish something new.
- Every story has its own page with **WhatsApp, Facebook and X share buttons**.
