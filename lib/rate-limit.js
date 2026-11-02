// Limits how often one visitor can use a form or button (sign in, newsletter, poll, phone alerts). Counts are kept in
// Supabase (supabase/security.sql) so they hold across all of the website's servers; if that table is not set up yet,
// or Supabase does not answer, counts are kept in the server's memory instead. The limiter never blocks visitors
// because of its own failure.
import { db } from "./db.js";

const memory = new Map();

function memoryHit(key, windowSec, now) {
  const entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    memory.set(key, { n: 1, resetAt: now + windowSec * 1000 });
    if (memory.size > 5000) for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
    return 1;
  }
  return ++entry.n;
}

// { key, limit, windowSec }: at most `limit` uses of `key` in `windowSec` seconds.
// durable: false keeps the count in memory only (for things done very often, such as story views).
export async function rateLimit({ key, limit, windowSec, durable = true, now = Date.now(), hit = (k, s) => db.hitRateLimit?.(k, s) }) {
  let count = null;
  if (durable) count = await Promise.resolve(hit(key, windowSec)).catch(() => null);
  if (typeof count !== "number") count = memoryHit(key, windowSec, now);
  return { ok: count <= limit, count, retryAfter: windowSec };
}

// The visitor's address as the hosting service reports it (visitors cannot set these headers on Vercel).
export function clientIp(headers) {
  const get = (name) => (typeof headers.get === "function" ? headers.get(name) : headers[name]);
  const forwarded = String(get("x-forwarded-for") || "").split(",")[0].trim();
  return String(get("x-real-ip") || forwarded || "unknown").slice(0, 64);
}

// A ready-made "too many tries" answer for the API routes.
export const tooMany = (retryAfter = 600) =>
  Response.json({ error: "too many tries, please wait a while" }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
