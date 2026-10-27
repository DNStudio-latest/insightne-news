# Guide 4: Switch on the daily email

The daily email is already built into the website. It stays **hidden** until you finish these steps.
Do them when you have your official email address (for example `news@insightnenews.in`).

**Cost:** free for up to **300 emails a day** (Brevo free plan). If you get more than 300 subscribers,
the website stops and tells you. Then ask Claude about a paid plan before sending.

## 1. Database (one time)
Supabase → SQL Editor → paste the whole `supabase/schema.sql` file → **Run** → "Success".

## 2. Make a free Brevo account
1. Go to **brevo.com** and sign up (free plan, no card needed).
2. **Senders, Domains & Dedicated IPs → Domains → Add a domain** → `insightnenews.in`.
3. Brevo shows a few DNS records. Tell Claude before you add them in GoDaddy (they are added next to
   your website records; nothing is removed).
4. **Senders → Add a sender**: name `InsightNE News`, email = your official address.

## 3. Get the key
Brevo → your name (top right) → **SMTP & API → API Keys → Generate a new API key**.
Copy it into Notepad. **Never send it in chat.**

## 4. Add 2 secret settings in Vercel
Vercel → project → **Settings → Environment Variables**:

| Name | Value |
| --- | --- |
| `BREVO_API_KEY` | the key from step 3 |
| `NEWSLETTER_FROM` | your official sender email |

Then **Deployments → ⋯ → Redeploy**.

## 5. Using it
- Readers sign up in the box at the bottom of every page, on story pages, and on **/today**.
  They must tap the link in a confirmation email before they get anything.
- To send: **/admin → ✉ Daily email** → read the preview → tick "I have read the preview" → **SEND**.
  Once a day is plenty.
