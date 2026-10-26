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
    async listStories({ status, region, topic, kind, limit = 50, offset = 0 }) {
      let q = sb.from("stories").select(withSources).eq("status", status);
      if (region) q = q.eq("region", region);
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
          .or(`headline.ilike.${like},summary.ilike.${like},body.ilike.${like}`)
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
    async listStories({ status, region, topic, kind, limit = 50, offset = 0 }) {
      const db = load();
      return db.stories
        .filter((s) => s.status === status && (!region || s.region === region) && (!topic || s.topic === topic) && (!kind || (s.kind || "brief") === kind))
        .sort(sortFor(status))
        .slice(offset, offset + limit)
        .map((s) => attach(db, s));
    },
    async searchStories(query, { status = "approved", limit = 30 } = {}) {
      const words = cleanSearch(query).toLowerCase().split(" ").filter(Boolean);
      if (!words.length) return [];
      const db = load();
      return db.stories
        .filter((s) => s.status === status && words.every((w) => `${s.headline} ${s.summary} ${s.body || ""}`.toLowerCase().includes(w)))
        .sort(sortFor(status))
        .slice(0, limit)
        .map((s) => attach(db, s));
    },
    async getStory(id) {
      const db = load();
      const story = db.stories.find((s) => s.id === id);
      return story ? attach(db, story) : null;
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
