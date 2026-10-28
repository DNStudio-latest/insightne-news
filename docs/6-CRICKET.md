# Guide 6: Switch on the live cricket score

The website shows India men's matches (Tests, ODIs, T20Is) automatically:
- a blue **🏏 LIVE** strip at the very top of every page while India is playing,
- a score box on the front page (live score, today's result, or the next match within a day).

Only the senior men's team is shown (not India Women, India A, U19 or Legends).

**Cost: free.** CricketData.org's free plan gives 100 updates a day; the site uses at most 96
(one every 15 minutes, shared by all readers). Faster updates need their paid plan (from about
$5.99 a month) — ask Claude first.

## Steps
1. Go to **cricketdata.org** → **Sign up** (free, no card).
2. After signing in, open your **Dashboard** and copy your **API key** into Notepad. Never send it in chat.
3. Vercel → project → **Settings → Environment Variables** → add
   - Name: `CRICKETDATA_API_KEY`
   - Value: the key
4. **Save**, then **Deployments → ⋯ → Redeploy**.

The score appears by itself the next time India plays. Without the key, nothing changes on the site.
