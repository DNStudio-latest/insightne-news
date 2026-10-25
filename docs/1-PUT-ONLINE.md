# Guide 1 — Put InsightNE News online

This takes about **45–60 minutes** the first time. You only do it once.

You will create four free accounts. Each one does one job:

| Service | What it does for you | Cost |
|---|---|---|
| **GitHub** | Keeps a copy of your website's files, and runs the news collector every 3 hours | Free |
| **Supabase** | The database: stores stories, sources, and your approvals | Free |
| **Vercel** | Shows your website on the internet | Free (see the note below) |
| **Anthropic (Claude)** | The AI that scores and summarizes stories | **Pay as you use** — about **$1–3 a month** (₹85–250) |

> **The only thing that costs money is Claude.** Before you add money there, read Step 3 and
> set a spending limit. Nothing else in this guide asks for a card.

> **Note about Vercel's free plan:** it is meant for personal, non-commercial websites. If you later put
> paid ads on the site, Vercel asks you to move to its Pro plan (about $20 a month). Ask me first and we can
> look at other choices.

---

## Step 1 — Put the files on GitHub

1. Go to **github.com** and create a free account (if you don't have one).
2. Install **GitHub Desktop** from **desktop.github.com**, open it, and sign in with that GitHub account.
3. In GitHub Desktop: **File → Add local repository…** → **Choose…** → pick the folder
   `C:\Users\debna\insightne-news` → **Add repository**.
4. Click the blue **Publish repository** button at the top.
5. Name: `insightne-news`. Make sure **"Keep this code private"** is **ticked**. Click **Publish repository**.
6. Check: go to github.com → your profile → **Repositories**. You should see `insightne-news` with a 🔒 Private label.

Your secret password file (`.env.local`) and the practice database (`data/`) are automatically **left out**,
so no secrets go to GitHub.

## Step 2 — Create the database on Supabase

1. Go to **supabase.com** → **Start your project** → sign in with your GitHub account.
2. Click **New project**. Name: `insightne-news`. Make up a database password and save it somewhere safe.
   Region: **South Asia (Mumbai)**. Plan: **Free**. Click **Create new project** and wait 2 minutes.
3. On the left, click **SQL Editor** → **New query**.
4. Open the file `supabase/schema.sql` from your project folder (Notepad is fine), copy **everything**,
   paste it into Supabase, and click **Run**. You should see "Success. No rows returned".
5. On the left, click **Project Settings** (the gear) → **API Keys**. Write down two things:
   - **Project URL** (looks like `https://abcd1234.supabase.co`). It is also under **Project Settings → Data API**.
   - **Secret key** (starts with `sb_secret_…`). Click the eye or "Reveal" to see it.
     On older projects this is called the **service_role** key — that works too.

   ⚠ The secret key is like a master key. Never share it or put it in a file inside the project.

## Step 3 — Get a Claude key and set a spending limit

There are two ways to pay for Claude. Use **one** of them.

### Way A — through OpenRouter (works with crypto; what InsightNE uses)

Indian bank cards are often refused by foreign websites. OpenRouter sells the same Claude Haiku model at the
same price and accepts crypto. (It adds a small fee of about 5% when you buy credit, and crypto top-ups cannot be refunded.)

1. Go to **openrouter.ai** → **Sign in** (Google, GitHub or email).
2. Click your profile → **Credits** → **Add credits** → choose **Crypto** and a small amount, such as **$5**.
   **This is the only step that costs money.** You do the payment yourself in your crypto wallet.
   Prepaid credit is also a natural spending limit: when it runs out, Claude simply stops until you add more.
3. Click your profile → **Keys** → **Create Key**. Name it `insightne-collector`.
   Set **Credit limit** to **5** (dollars) — a second safety limit for this key. Click **Create**.
4. Copy the key (starts with `sk-or-`). You will only see it once.
5. In Step 4, save it as `OPENROUTER_API_KEY` (not `ANTHROPIC_API_KEY`).

### Way B — directly from Anthropic (needs a card that pays foreign websites)

1. Go to **console.anthropic.com** and create an account.
2. **Set the spending limit first:** **Settings → Limits** → set a **monthly spend limit** of **$5**.
   If the limit is reached, Claude simply stops for the rest of the month; the website keeps working,
   and the collector tries again next month. (Expected use is about $1–3 a month.)
3. **Settings → Billing** → add a small amount of credit, such as $5.
   **This is the only step that costs money.** You decide when to do it.
4. **Settings → API Keys → Create Key**. Name it `insightne-collector`. Copy the key (starts with `sk-ant-`).
   You will only see it once.

## Step 4 — Give GitHub the secrets (for the collector)

1. On github.com, open your `insightne-news` repository → **Settings** → **Secrets and variables** → **Actions**.
2. Click **New repository secret** three times and add:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase Project URL |
   | `SUPABASE_SECRET_KEY` | your Supabase secret key |
   | `OPENROUTER_API_KEY` | your OpenRouter key (`sk-or-…`) — **or**, if you used Way B, name it `ANTHROPIC_API_KEY` with your `sk-ant-…` key |

3. Click the **Actions** tab. If asked, click **"I understand my workflows, go ahead and enable them"**.
4. Click **Collect news** on the left → **Run workflow** → **Run workflow**. Wait 2–3 minutes.
   A green tick ✓ means it worked. Click it to read the report (how many feeds worked, how many stories).
   From now on it runs by itself every 3 hours.

## Step 5 — Put the website on Vercel

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub**. Choose the **Hobby** (free) plan.
2. Click **Add New… → Project** → find `insightne-news` → **Import**.
3. Open **Environment Variables** and add these four:

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | your Supabase Project URL |
   | `SUPABASE_SECRET_KEY` | your Supabase secret key |
   | `ADMIN_PASSWORD` | the password for **your approval page**. Make it long, e.g. four random words: `mango-river-lamp-forty` |
   | `SESSION_SECRET` | any long random text, at least 32 letters/numbers. Just type a long jumble. |

   (Vercel does **not** need the Claude key. Only the collector uses Claude.)
4. Click **Deploy**. After about 2 minutes you get a web address like `insightne-news.vercel.app`.

## Step 6 — Check it

- Open `https://YOUR-ADDRESS.vercel.app/admin` on your phone → type your `ADMIN_PASSWORD` → you should see the
  stories the collector found in Step 4.
- Approve one, then open `https://YOUR-ADDRESS.vercel.app` — it appears on the home page.
- Tip: on your phone, open the approval page and choose **Add to Home Screen**, so it opens like an app.

## Optional — your own web address

Buy a name such as `insightnenews.in` from any domain seller (about ₹500–900 a year — **this costs money,
so it is your choice**). Then in Vercel: **Project → Settings → Domains → Add**, and follow the instructions.

---

## If something goes wrong

| Problem | What to do |
|---|---|
| GitHub Actions shows a red ✗ | Click it and read the last lines. "ANTHROPIC_API_KEY is missing" → check Step 4 spelling. "Database error" → check the Supabase URL and key. |
| Approval page says "Application error" | In Vercel, check that all four environment variables are there and spelled exactly. Then **Deployments → ⋯ → Redeploy**. |
| No new stories for a day | GitHub sometimes delays scheduled runs. Run it by hand (Step 4, point 4). Also check your Claude spending limit was not reached. |
| A feed shows "not working" on the approval page | That site's feed is down or moved. The others keep working. See Guide 2. |
| Supabase sends "project paused" email | Free projects pause after 7 days with no use. The collector uses it every 3 hours, so this only happens if the collector stopped. Click **Restore** in Supabase. |
