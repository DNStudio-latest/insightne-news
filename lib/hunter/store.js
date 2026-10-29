// Where the News Hunter keeps what it found and the drafts it wrote.
// Online: Supabase tables hunter_pages, hunter_items, hunter_drafts, hunter_runs (supabase/hunter.sql).
// Practice mode (no Supabase settings): data/hunter-db.json on this computer.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const usingSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

function supabaseStore() {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
  const check = ({ data, error }) => {
    if (error) throw new Error(`Database error: ${error.message}`);
    return data;
  };
  return {
    async getPage(url) {
      return check(await sb.from("hunter_pages").select("*").eq("url", url).maybeSingle());
    },
    async savePage(row) {
      check(await sb.from("hunter_pages").upsert(row, { onConflict: "url" }));
    },
    async listPages() {
      return check(await sb.from("hunter_pages").select("*").order("url"));
    },
    async knownUrls(urls) {
      const known = new Set();
      for (let i = 0; i < urls.length; i += 25) {
        check(await sb.from("hunter_items").select("url").in("url", urls.slice(i, i + 25))).forEach((r) => known.add(r.url));
      }
      return known;
    },
    async addItems(rows) {
      if (rows.length) check(await sb.from("hunter_items").upsert(rows, { onConflict: "url", ignoreDuplicates: true }));
    },
    async fingerprintSeen(fingerprint, exceptId) {
      const rows = check(await sb.from("hunter_items").select("id").eq("fingerprint", fingerprint).neq("id", exceptId).limit(1));
      return rows.length > 0;
    },
    async itemsWithStatus(status, limit = 50) {
      return check(await sb.from("hunter_items").select("*").eq("status", status).order("found_at", { ascending: true }).limit(limit));
    },
    async updateItem(id, fields) {
      check(await sb.from("hunter_items").update(fields).eq("id", id));
    },
    async createDraft(draft) {
      const id = crypto.randomUUID();
      check(await sb.from("hunter_drafts").insert({ id, ...draft }));
      return id;
    },
    async getDraft(id) {
      return check(await sb.from("hunter_drafts").select("*").eq("id", id).maybeSingle());
    },
    async updateDraft(id, fields) {
      check(await sb.from("hunter_drafts").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", id));
    },
    async listDrafts({ status, limit = 300 }) {
      return check(await sb.from("hunter_drafts").select("*").eq("status", status).order("event_at", { ascending: false }).limit(limit));
    },
    async recentDrafts(days) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      return check(await sb.from("hunter_drafts").select("id, event, headline, state, sources, status").gte("created_at", since));
    },
    async logRun(run) {
      check(await sb.from("hunter_runs").insert(run));
    },
    async lastRun() {
      return check(await sb.from("hunter_runs").select("*").order("started_at", { ascending: false }).limit(1).maybeSingle());
    },
  };
}

function localStore(file = path.join(process.cwd(), "data", "hunter-db.json")) {
  const load = () => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : { pages: [], items: [], drafts: [], runs: [] });
  const save = (db) => (fs.mkdirSync(path.dirname(file), { recursive: true }), fs.writeFileSync(file, JSON.stringify(db, null, 1)));
  const change = (fn) => {
    const db = load();
    const result = fn(db);
    save(db);
    return result;
  };
  const newest = (key) => (a, b) => String(b[key]).localeCompare(String(a[key]));
  return {
    async getPage(url) {
      return load().pages.find((p) => p.url === url) || null;
    },
    async savePage(row) {
      change((db) => {
        const i = db.pages.findIndex((p) => p.url === row.url);
        db.pages[i < 0 ? db.pages.length : i] = { ...db.pages[i], ...row };
      });
    },
    async listPages() {
      return load().pages;
    },
    async knownUrls(urls) {
      const all = new Set(load().items.map((i) => i.url));
      return new Set(urls.filter((u) => all.has(u)));
    },
    async addItems(rows) {
      change((db) => {
        const all = new Set(db.items.map((i) => i.url));
        for (const r of rows) if (!all.has(r.url)) db.items.push({ id: crypto.randomUUID(), found_at: new Date().toISOString(), ...r });
      });
    },
    async fingerprintSeen(fingerprint, exceptId) {
      return load().items.some((i) => i.fingerprint === fingerprint && i.id !== exceptId);
    },
    async itemsWithStatus(status, limit = 50) {
      return load().items.filter((i) => i.status === status).slice(0, limit);
    },
    async updateItem(id, fields) {
      change((db) => Object.assign(db.items.find((i) => i.id === id) || {}, fields));
    },
    async createDraft(draft) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      change((db) => db.drafts.push({ id, created_at: now, updated_at: now, status: "pending", ...draft }));
      return id;
    },
    async getDraft(id) {
      return load().drafts.find((d) => d.id === id) || null;
    },
    async updateDraft(id, fields) {
      change((db) => Object.assign(db.drafts.find((d) => d.id === id) || {}, fields, { updated_at: new Date().toISOString() }));
    },
    async listDrafts({ status, limit = 300 }) {
      return load().drafts.filter((d) => d.status === status).sort(newest("event_at")).slice(0, limit);
    },
    async recentDrafts(days) {
      const since = new Date(Date.now() - days * 86400000).toISOString();
      return load().drafts.filter((d) => d.created_at >= since);
    },
    async logRun(run) {
      change((db) => db.runs.push(run));
    },
    async lastRun() {
      return load().runs.sort(newest("started_at"))[0] || null;
    },
  };
}

export const hunterStore = usingSupabase ? supabaseStore() : localStore();
export { localStore as createLocalHunterStore };
