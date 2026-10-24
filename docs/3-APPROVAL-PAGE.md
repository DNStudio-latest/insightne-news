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

- **Score 8/10** — how important Claude thinks it is for Tripura and Northeast readers (only 6 and above are shown).
- **Tripura / Northeast** and a topic such as **Politics** — where it will appear on the site.
- **⚠ NEEDS EXTRA CHECK** with reasons — see below.
- **Headline and summary** — written in our own words, not copied.
- **Sources** — every site that reported it. Tap one to open the original article. "Their headline" shows
  the original title so you can compare.

## The three buttons

| Button | What it does |
|---|---|
| **APPROVE** | Publishes it on the website **immediately**. |
| **EDIT** | Opens a box where you can change the headline, summary, area and topic. Then press **SAVE** (keeps it pending) or **SAVE & APPROVE** (publishes it). |
| **REJECT** | Removes it from the list. It never appears on the site. (You can bring it back from the **Rejected** tab.) |

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
