// Keeps the latest results and runs one refresh: ask the portal (at most once per interval), read the answer, check it,
// save it, then share the big updates. Everything is kept in site settings, so no database change is needed.
//   results_<slug>          the latest good snapshot
//   results_meta_<slug>     { paused, social, lastAttemptAt, lastOkAt, lastError, issues, posted, events, lockAt }
//   results_config_<slug>   settings changed on /admin/results (they override results.json)
import defaults from "../../results.json" with { type: "json" };
import { fetchSec } from "./sec-source.js";
import { normaliseResults } from "./model.js";
import { checkSnapshot } from "./checks.js";
import { detectMilestones } from "./milestones.js";
import { loadManual, snapshotFromManual } from "./manual.js";

export const elections = () => defaults.elections;

export async function electionConfig(db, slug) {
  const base = defaults.elections.find((e) => e.slug === slug);
  if (!base) return null;
  const o = (await db.getSetting(`results_config_${slug}`).catch(() => null)) || {};
  return { ...base, ...o, source: { ...base.source, ...(o.source || {}), keys: { ...base.source.keys, ...(o.source?.keys || {}) } }, window: { ...base.window, ...(o.window || {}) }, social: { ...base.social, ...(o.social || {}) } };
}

export const loadSnapshot = (db, slug) => db.getSetting(`results_${slug}`).catch(() => null);
export async function loadMeta(db, slug) {
  const m = (await db.getSetting(`results_meta_${slug}`).catch(() => null)) || {};
  return { paused: false, social: true, issues: [], posted: [], events: [], ...m };
}
const saveMeta = (db, slug, meta) => db.setSetting(`results_meta_${slug}`, meta);

// Is the counting window open now? (Outside it nothing is read from the portal.)
export function inWindow(cfg, now = Date.now()) {
  const from = cfg.window?.from ? Date.parse(cfg.window.from) : -Infinity;
  const to = cfg.window?.to ? Date.parse(cfg.window.to) : Infinity;
  return now >= from && now <= to;
}
export const isLive = (cfg, now = Date.now()) => Boolean(cfg?.enabled) && inWindow(cfg, now);

// A seat keeps the time we first saw it declared.
function carryTimes(prev, next, iso) {
  const before = new Map((prev?.units || []).flatMap((u) => u.seats.map((s) => [`${u.id}|${s.id}`, s])));
  for (const u of next.units) for (const s of u.seats) if (s.declared) s.at = before.get(`${u.id}|${s.id}`)?.at || iso;
}

// One refresh. Returns { status: "skipped" | "paused" | "outside" | "held" | "updated" | "failed", ... }.
// shareFn(db, cfg, events, snapshot) posts the big updates (lib/results/social.js); it is given so tests can replace it.
export async function refreshResults(cfg, { db, fetchFn = fetch, now = Date.now(), force = false, shareFn = null } = {}) {
  const slug = cfg.slug;
  const meta = await loadMeta(db, slug);
  if (!cfg.enabled && !force) return { status: "disabled" };
  if (meta.paused && !force) return { status: "paused" };
  if (!inWindow(cfg, now) && !force) return { status: "outside" };
  if (!force && meta.lastAttemptAt && now - meta.lastAttemptAt < (cfg.pollSeconds || 120) * 1000) return { status: "skipped" };
  if (meta.lockAt && now - meta.lockAt < 90000) return { status: "skipped" };
  meta.lockAt = now;
  meta.lastAttemptAt = now;
  await saveMeta(db, slug, meta);

  const iso = new Date(now).toISOString();
  try {
    const prev = await loadSnapshot(db, slug);
    // Plan B: while manual entry is on, the seats typed by hand replace the portal reading.
    const manual = await loadManual(db, slug);
    let next;
    if (manual.on) next = snapshotFromManual(manual.entries, { slug, expectedSeats: cfg.expectedSeats, now: iso });
    else {
      const raw = await fetchSec(cfg.source, { fetchFn });
      next = normaliseResults(raw.results, raw.summary, { slug, updatedLabel: raw.updatedLabel, now: iso });
    }
    carryTimes(prev, next, iso);
    const check = checkSnapshot(prev, next, { expectedSeats: cfg.expectedSeats });
    meta.issues = check.issues.slice(0, 30).map((i) => ({ ...i, at: iso }));
    if (!check.ok) {
      meta.lastError = `Update held: ${check.issues.find((i) => i.level === "stop").text}`;
      meta.lockAt = 0;
      await saveMeta(db, slug, meta);
      return { status: "held", issues: check.issues };
    }
    await db.setSetting(`results_${slug}`, next);
    meta.lastOkAt = now;
    meta.lastError = null;

    let events = [];
    if (cfg.social?.enabled !== false && meta.social !== false && shareFn) {
      const found = detectMilestones(next, new Set(meta.posted), { keyContests: cfg.keyContests || [] });
      meta.posted = [...meta.posted, ...found.skip];
      events = found.events.slice(0, 2); // at most 2 posts per refresh: updates are spread out, the rest wait for the next refresh
      if (events.length) {
        const sent = await shareFn(db, cfg, events, next).catch((err) => events.map((e) => ({ key: e.key, error: err.message })));
        meta.posted = [...meta.posted, ...events.map((e) => e.key)];
        meta.events = [...sent.map((s) => ({ at: iso, ...s })), ...meta.events].slice(0, 60);
      }
    }
    meta.lockAt = 0;
    await saveMeta(db, slug, meta);
    return { status: "updated", declared: next.totals.declared, events: events.length };
  } catch (err) {
    meta.lastError = err.message.slice(0, 300);
    meta.lockAt = 0;
    await saveMeta(db, slug, meta);
    return { status: "failed", error: err.message };
  }
}
