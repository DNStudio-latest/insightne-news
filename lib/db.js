// Where stories are saved.
// - Online (Supabase): used when SUPABASE_URL and SUPABASE_SECRET_KEY are set.
// - Practice mode: if those are not set, everything is saved in data/local-db.json
//   on your own computer, so you can try the website without any accounts.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;

export const usingSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY);

// A readable web address for a story, e.g. "cm-opens-new-office-a1b2c3".
export function makeSlug(headline, id = crypto.randomUUID()) {
  const words = String(headline || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 70)
    .replace(/(^-+|-+$)/g, "");
  return `${words || "story"}-${String(id).replace(/-/g, "").slice(0, 6)}`;
}

// Only letters, numbers and spaces are searched, so a search can never break the database query.
export function cleanSearch(q) {
  return String(q || "").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

// ---------- Supabase (online) ----------

function supabaseDb() {
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const check = ({ data, error }) => {
    if (error) throw new Error(`Database error: ${error.message}`);
    return data;
  };
  const withSources = "*, sources:story_sources(*)";

  return {
    async seenUrls(urls) {
      const seen = new Set();
      // Small batches: the list of links travels inside the web address, which has a length limit.
      for (let i = 0; i < urls.length; i += 25) {
        const rows = check(await sb.from("seen_articles").select("url").in("url", urls.slice(i, i + 25)));
        rows.forEach((r) => seen.add(r.url));
      }
      return seen;
    },
    async markSeen(rows) {
      if (rows.length) check(await sb.from("seen_articles").upsert(rows, { onConflict: "url" }));
    },
    async forgetSeenOlderThan(days) {
      const before = new Date(Date.now() - days * 86400000).toISOString();
      check(await sb.from("seen_articles").delete().lt("seen_at", before));
    },
    async recentStories(days) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      return check(await sb.from("stories").select("id, headline, status").gte("created_at", since));
    },
    async createStory(story, sources = []) {
      const id = crypto.randomUUID();
      check(await sb.from("stories").insert({ id, slug: makeSlug(story.headline, id), ...story }));
      await this.addSources(id, sources);
      return id;
    },
    async addSources(storyId, sources) {
      if (!sources.length) return;
      const rows = sources.map((s) => ({ ...s, story_id: storyId }));
      check(await sb.from("story_sources").upsert(rows, { onConflict: "url", ignoreDuplicates: true }));
    },
    async listStories({ status, region, regionIn, topic, kind, breaking, limit = 50, offset = 0 }) {
      let q = sb.from("stories").select(withSources).eq("status", status);
      if (breaking) q = q.eq("is_breaking", true);
      if (region) q = q.eq("region", region);
      if (regionIn) q = q.in("region", regionIn);
      if (topic) q = q.eq("topic", topic);
      if (kind) q = q.eq("kind", kind);
      if (status === "approved") q = q.order("published_at", { ascending: false });
      else if (status === "pending") q = q.order("score", { ascending: false, nullsFirst: true }).order("created_at", { ascending: false });
      else q = q.order("created_at", { ascending: false });
      return check(await q.range(offset, offset + limit - 1));
    },
    // Finds stories by words in the headline, summary or text. The website searches published stories;
    // the approval page can also search pending and rejected ones.
    async searchStories(query, { status = "approved", limit = 30 } = {}) {
      const q = cleanSearch(query);
      if (!q) return [];
      const like = `%${q.replace(/\s+/g, "%")}%`;
      return check(
        await sb
          .from("stories")
          .select(withSources)
          .eq("status", status)
          .or(`headline.ilike.${like},summary.ilike.${like},body.ilike.${like},headline_bn.ilike.${like},summary_bn.ilike.${like}`)
          .order(status === "approved" ? "published_at" : "created_at", { ascending: false })
          .limit(limit),
      );
    },
    async getStory(id) {
      return check(await sb.from("stories").select(withSources).eq("id", id).maybeSingle());
    },
    async getStoryBySlug(slug) {
      return check(await sb.from("stories").select(withSources).eq("slug", slug).maybeSingle());
    },
    // Short links like insightnenews.in/s/3defa2 use the last 6 letters of the story's web address.
    async getStoryByCode(code) {
      const rows = check(await sb.from("stories").select("slug").eq("status", "approved").like("slug", `%-${code}`).order("published_at", { ascending: false }).limit(1));
      return rows[0] || null;
    },
    async latestPublishedAt() {
      const rows = check(await sb.from("stories").select("published_at").eq("status", "approved").order("published_at", { ascending: false }).limit(1));
      return rows[0]?.published_at || null;
    },
    async allPublishedSlugs(limit = 1000) {
      return check(await sb.from("stories").select("slug, updated_at").eq("status", "approved").order("published_at", { ascending: false }).limit(limit));
    },
    async updateStory(id, fields) {
      check(await sb.from("stories").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id));
    },
    async setLead(id) {
      check(await sb.from("stories").update({ is_lead: false }).eq("is_lead", true));
      if (id) check(await sb.from("stories").update({ is_lead: true }).eq("id", id));
    },
    async uploadImage(bytes, contentType) {
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const name = `${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}.${ext}`;
      check(await sb.storage.from("images").upload(name, bytes, { contentType, upsert: false }));
      return sb.storage.from("images").getPublicUrl(name).data.publicUrl;
    },
    async countView(id) {
      check(await sb.rpc("count_view", { sid: id }));
    },
    // Most-read published stories since the given number of days ago (today = 1).
    async mostRead(days = 1, limit = 5) {
      const since = new Date(Date.now() - (days - 1) * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const rows = check(await sb.from("story_views").select("story_id, views").gte("day", since).limit(2000));
      const totals = new Map();
      for (const r of rows) totals.set(r.story_id, (totals.get(r.story_id) || 0) + r.views);
      const ids = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit * 3).map(([id]) => id);
      if (!ids.length) return [];
      const stories = check(await sb.from("stories").select(withSources).in("id", ids).eq("status", "approved"));
      return stories.sort((a, b) => totals.get(b.id) - totals.get(a.id)).slice(0, limit);
    },
    // ---- Reader polls ----
    async listPolls(limit = 30) {
      return check(await sb.from("polls").select("*").order("created_at", { ascending: false }).limit(limit));
    },
    async getPoll(id) {
      return check(await sb.from("polls").select("*").eq("id", id).maybeSingle());
    },
    async openPoll() {
      return check(await sb.from("polls").select("*").eq("is_open", true).order("created_at", { ascending: false }).limit(1))[0] || null;
    },
    async createPoll(poll) {
      check(await sb.from("polls").insert(poll));
    },
    async updatePoll(id, fields) {
      check(await sb.from("polls").update(fields).eq("id", id));
    },
    async deletePoll(id) {
      check(await sb.from("polls").delete().eq("id", id));
    },
    // Returns false if this reader already voted.
    async votePoll(id, choice, voter) {
      const { error } = await sb.from("poll_votes").insert({ poll_id: id, choice, voter });
      if (error?.code === "23505") return false;
      check({ error });
      return true;
    },
    async pollCounts(id, optionCount) {
      const counts = Array(optionCount).fill(0);
      for (const r of check(await sb.rpc("poll_counts", { pid: id }))) if (r.choice < optionCount) counts[r.choice] = Number(r.votes);
      return counts;
    },
    // ---- Phone alerts ----
    async savePushSubscription(sub) {
      check(await sb.from("push_subscriptions").upsert(sub, { onConflict: "endpoint" }));
    },
    async deletePushSubscription(endpoint) {
      check(await sb.from("push_subscriptions").delete().eq("endpoint", endpoint));
    },
    async listPushSubscriptions() {
      const all = [];
      for (let from = 0; ; from += 1000) {
        const rows = check(await sb.from("push_subscriptions").select("*").range(from, from + 999));
        all.push(...rows);
        if (rows.length < 1000) return all;
      }
    },
    // ---- Email newsletter ----
    async getSubscriber({ email, token }) {
      const q = sb.from("newsletter_subscribers").select("*");
      return check(await (email ? q.eq("email", email) : q.eq("token", token)).maybeSingle());
    },
    async addSubscriber(row) {
      check(await sb.from("newsletter_subscribers").insert(row));
    },
    async updateSubscriber(email, fields) {
      check(await sb.from("newsletter_subscribers").update(fields).eq("email", email));
    },
    async deleteSubscriber(email) {
      check(await sb.from("newsletter_subscribers").delete().eq("email", email));
    },
    async listSubscribers({ confirmed } = {}) {
      const all = [];
      for (let from = 0; ; from += 1000) {
        let q = sb.from("newsletter_subscribers").select("*").order("created_at").range(from, from + 999);
        if (confirmed !== undefined) q = q.eq("confirmed", confirmed);
        const rows = check(await q);
        all.push(...rows);
        if (rows.length < 1000) return all;
      }
    },
    async logNewsletter(row) {
      check(await sb.from("newsletter_sends").insert(row));
    },
    async lastNewsletters(limit = 10) {
      return check(await sb.from("newsletter_sends").select("*").order("sent_at", { ascending: false }).limit(limit));
    },
    async logRun(run) {
      check(await sb.from("collector_runs").insert(run));
    },
    async lastRun() {
      const rows = check(await sb.from("collector_runs").select("*").order("started_at", { ascending: false }).limit(1));
      return rows[0] || null;
    },
  };
}

// ---------- Practice mode (a file on your computer) ----------

function localDb() {
  const file = process.env.LOCAL_DB_FILE || path.join(process.cwd(), "data", "local-db.json");
  const load = () => {
    try {
      return JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      return { stories: [], sources: [], seen: {}, runs: [] };
    }
  };
  const save = (db) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(db, null, 2));
  };
  const attach = (db, story) => ({ ...story, slug: story.slug || makeSlug(story.headline, story.id), sources: db.sources.filter((s) => s.story_id === story.id) });
  const sortFor = (status) => {
    const key = status === "approved" ? "published_at" : "created_at";
    return (a, b) => (status === "pending" ? (b.score ?? 99) - (a.score ?? 99) : 0) || String(b[key]).localeCompare(String(a[key]));
  };

  return {
    async seenUrls(urls) {
      const { seen } = load();
      return new Set(urls.filter((u) => seen[u]));
    },
    async markSeen(rows) {
      const db = load();
      for (const r of rows) db.seen[r.url] = { ...r, seen_at: new Date().toISOString() };
      save(db);
    },
    async forgetSeenOlderThan(days) {
      const db = load();
      const before = Date.now() - days * 86400000;
      for (const [url, r] of Object.entries(db.seen)) if (new Date(r.seen_at).getTime() < before) delete db.seen[url];
      save(db);
    },
    async recentStories(days) {
      const since = Date.now() - days * 86400000;
      return load()
        .stories.filter((s) => new Date(s.created_at).getTime() >= since)
        .map(({ id, headline, status }) => ({ id, headline, status }));
    },
    async createStory(story, sources = []) {
      const db = load();
      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const row = { id, slug: makeSlug(story.headline, id), kind: "brief", is_lead: false, status: "pending", created_at: now, updated_at: now, published_at: null, auto_published: false, ...story };
      db.stories.push(row);
      save(db);
      await this.addSources(row.id, sources);
      return row.id;
    },
    async addSources(storyId, sources) {
      const db = load();
      for (const s of sources) {
        if (!db.sources.some((x) => x.url === s.url)) db.sources.push({ ...s, story_id: storyId, added_at: new Date().toISOString() });
      }
      save(db);
    },
    async listStories({ status, region, regionIn, topic, kind, breaking, limit = 50, offset = 0 }) {
      const db = load();
      return db.stories
        .filter((s) => s.status === status && (!breaking || s.is_breaking) && (!region || s.region === region) && (!regionIn || regionIn.includes(s.region)) && (!topic || s.topic === topic) && (!kind || (s.kind || "brief") === kind))
        .sort(sortFor(status))
        .slice(offset, offset + limit)
        .map((s) => attach(db, s));
    },
    async searchStories(query, { status = "approved", limit = 30 } = {}) {
      const words = cleanSearch(query).toLowerCase().split(" ").filter(Boolean);
      if (!words.length) return [];
      const db = load();
      return db.stories
        .filter((s) => s.status === status && words.every((w) => `${s.headline} ${s.summary} ${s.body || ""} ${s.headline_bn || ""} ${s.summary_bn || ""}`.toLowerCase().includes(w)))
        .sort(sortFor(status))
        .slice(0, limit)
        .map((s) => attach(db, s));
    },
    async getStory(id) {
      const db = load();
      const story = db.stories.find((s) => s.id === id);
      return story ? attach(db, story) : null;
    },
    async getStoryByCode(code) {
      return (await this.listStories({ status: "approved", limit: 1000 })).find((st) => st.slug.endsWith(`-${code}`)) || null;
    },
    async getStoryBySlug(slug) {
      const db = load();
      const story = db.stories.find((s) => (s.slug || makeSlug(s.headline, s.id)) === slug);
      return story ? attach(db, story) : null;
    },
    async latestPublishedAt() {
      return (await this.listStories({ status: "approved", limit: 1 }))[0]?.published_at || null;
    },
    async allPublishedSlugs(limit = 1000) {
      return (await this.listStories({ status: "approved", limit })).map(({ slug, updated_at }) => ({ slug, updated_at }));
    },
    async updateStory(id, fields) {
      const db = load();
      const story = db.stories.find((s) => s.id === id);
      if (story) Object.assign(story, fields, { updated_at: new Date().toISOString() });
      save(db);
    },
    async setLead(id) {
      const db = load();
      for (const s of db.stories) s.is_lead = s.id === id;
      save(db);
    },
    // On your own computer, photos are saved in data/uploads and shown by /api/uploads/….
    async uploadImage(bytes, contentType) {
      const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
      const name = `${crypto.randomUUID()}.${ext}`;
      const dir = path.join(path.dirname(file), "uploads");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, name), Buffer.from(bytes));
      return `/api/uploads/${name}`;
    },
    async countView(id) {
      const db = load();
      const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      db.views = db.views || {};
      db.views[id] = db.views[id] || {};
      db.views[id][day] = (db.views[id][day] || 0) + 1;
      save(db);
    },
    async mostRead(days = 1, limit = 5) {
      const db = load();
      const since = new Date(Date.now() - (days - 1) * 86400000).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
      const total = (id) => Object.entries((db.views || {})[id] || {}).reduce((n, [d, v]) => (d >= since ? n + v : n), 0);
      return db.stories
        .filter((s) => s.status === "approved" && total(s.id) > 0)
        .sort((a, b) => total(b.id) - total(a.id))
        .slice(0, limit)
        .map((s) => attach(db, s));
    },
    async listPolls(limit = 30) {
      return [...(load().polls || [])].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, limit);
    },
    async getPoll(id) {
      return (load().polls || []).find((p) => p.id === id) || null;
    },
    async openPoll() {
      return (await this.listPolls()).find((p) => p.is_open) || null;
    },
    async createPoll(poll) {
      const db = load();
      db.polls = [...(db.polls || []), { id: crypto.randomUUID(), is_open: true, created_at: new Date().toISOString(), ...poll }];
      save(db);
    },
    async updatePoll(id, fields) {
      const db = load();
      Object.assign((db.polls || []).find((p) => p.id === id) || {}, fields);
      save(db);
    },
    async deletePoll(id) {
      const db = load();
      db.polls = (db.polls || []).filter((p) => p.id !== id);
      db.pollVotes = (db.pollVotes || []).filter((v) => v.poll_id !== id);
      save(db);
    },
    async votePoll(id, choice, voter) {
      const db = load();
      db.pollVotes = db.pollVotes || [];
      if (db.pollVotes.some((v) => v.poll_id === id && v.voter === voter)) return false;
      db.pollVotes.push({ poll_id: id, choice, voter, voted_at: new Date().toISOString() });
      save(db);
      return true;
    },
    async pollCounts(id, optionCount) {
      const counts = Array(optionCount).fill(0);
      for (const v of load().pollVotes || []) if (v.poll_id === id && v.choice < optionCount) counts[v.choice]++;
      return counts;
    },
    async savePushSubscription(sub) {
      const db = load();
      db.push = (db.push || []).filter((p) => p.endpoint !== sub.endpoint).concat({ ...sub, created_at: new Date().toISOString() });
      save(db);
    },
    async deletePushSubscription(endpoint) {
      const db = load();
      db.push = (db.push || []).filter((p) => p.endpoint !== endpoint);
      save(db);
    },
    async listPushSubscriptions() {
      return load().push || [];
    },
    async getSubscriber({ email, token }) {
      return (load().subscribers || []).find((r) => (email ? r.email === email : r.token === token)) || null;
    },
    async addSubscriber(row) {
      const db = load();
      db.subscribers = [...(db.subscribers || []), { confirmed: false, created_at: new Date().toISOString(), ...row }];
      save(db);
    },
    async updateSubscriber(email, fields) {
      const db = load();
      Object.assign((db.subscribers || []).find((r) => r.email === email) || {}, fields);
      save(db);
    },
    async deleteSubscriber(email) {
      const db = load();
      db.subscribers = (db.subscribers || []).filter((r) => r.email !== email);
      save(db);
    },
    async listSubscribers({ confirmed } = {}) {
      return (load().subscribers || []).filter((r) => confirmed === undefined || r.confirmed === confirmed);
    },
    async logNewsletter(row) {
      const db = load();
      db.newsletters = [{ sent_at: new Date().toISOString(), ...row }, ...(db.newsletters || [])].slice(0, 100);
      save(db);
    },
    async lastNewsletters(limit = 10) {
      return (load().newsletters || []).slice(0, limit);
    },
    async logRun(run) {
      const db = load();
      db.runs = [run, ...db.runs].slice(0, 50);
      save(db);
    },
    async lastRun() {
      return load().runs[0] || null;
    },
  };
}

export const db = usingSupabase ? supabaseDb() : localDb();
