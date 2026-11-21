// Where the phone "News desk" keeps its items: one site setting ("desk_items"), so no new database table is needed
// (the same way the "Teach the AI" lessons are kept). Text only: photos live in the photo storage, clips never leave the phone.
import crypto from "node:crypto";
import { db } from "./db.js";

const KEY = "desk_items";
export const MAX_ITEMS = 80;

const LIMITS = { caption_bn: 20000, speakers: 1000, gemini_text: 60000, chatgpt_out: 60000, headline: 300, intro: 1500, story: 60000, photo_caption: 400, photo_credit: 160, title: 120 };

const clip = (v, n) => String(v ?? "").slice(0, n);

// Keeps only the known fields, with sensible lengths.
export function cleanItem(raw, existing = {}) {
  const r = raw || {};
  const out = { ...existing };
  for (const [k, n] of Object.entries(LIMITS)) if (k in r) out[k] = clip(r[k], n);
  for (const k of ["no_video", "no_photo"]) if (k in r) out[k] = Boolean(r[k]);
  for (const k of ["photo_url", "photo_urls"]) if (k in r) out[k] = Array.isArray(r[k]) ? r[k].map((u) => clip(u, 500)).slice(0, 10) : clip(r[k], 500);
  return out;
}

export async function loadItems(store = db) {
  const v = await store.getSetting(KEY);
  return Array.isArray(v) ? v : [];
}

async function saveAll(store, items) {
  await store.setSetting(KEY, items.slice(0, MAX_ITEMS));
}

export async function getItem(id, store = db) {
  return (await loadItems(store)).find((i) => i.id === id) || null;
}

// Adds a new item or changes one. Fields not sent are kept. Never deletes anything the phone did not ask to delete.
export async function saveItem(raw, { store = db, now = new Date() } = {}) {
  const items = await loadItems(store);
  const at = now.toISOString();
  const i = raw?.id ? items.findIndex((x) => x.id === raw.id) : -1;
  if (i >= 0) {
    const merged = cleanItem(raw, items[i]);
    // These are written only by the server (they record what really happened on the website).
    items[i] = { ...merged, updated_at: at };
    await saveAll(store, items);
    return items[i];
  }
  const fresh = { id: crypto.randomUUID(), created_at: at, updated_at: at, ...cleanItem(raw, {}) };
  if (!fresh.title) fresh.title = clip(fresh.caption_bn.split("\n")[0] || "New item", 60) || "New item";
  items.unshift(fresh);
  await saveAll(store, items);
  return fresh;
}

// Server-side facts only (draft link, published, hash of the text that was sent).
export async function markItem(id, fields, { store = db, now = new Date() } = {}) {
  const items = await loadItems(store);
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return null;
  items[i] = { ...items[i], ...fields, updated_at: now.toISOString() };
  await saveAll(store, items);
  return items[i];
}

// Removing an item is the one destructive action: it needs the phone to say so and keeps nothing else.
export async function deleteItem(id, store = db) {
  const items = await loadItems(store);
  await saveAll(store, items.filter((x) => x.id !== id));
}

export function textHash(item) {
  return crypto.createHash("sha256").update([item.headline, item.intro, item.story, item.photo_caption, item.photo_credit, item.photo_url].join("\u0001")).digest("hex").slice(0, 16);
}
