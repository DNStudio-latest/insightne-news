import { test } from "node:test";
import assert from "node:assert/strict";
import { rehearsalSnapshot } from "../lib/results/replay.js";
import { tally, majorityOf } from "../lib/results/model.js";
import { checkSnapshot } from "../lib/results/checks.js";
import { detectMilestones } from "../lib/results/milestones.js";
import { refreshResults, inWindow, isLive } from "../lib/results/store.js";
import { captionFor } from "../lib/results/social.js";

const mem = () => {
  const s = new Map();
  return { getSetting: async (k) => s.get(k) ?? null, setSetting: async (k, v) => void s.set(k, JSON.parse(JSON.stringify(v))), s };
};

test("rehearsal data has 345 seats and fills up as the percentage grows", () => {
  const none = rehearsalSnapshot(0);
  const half = rehearsalSnapshot(50);
  const all = rehearsalSnapshot(100);
  assert.equal(all.totals.seats, 345);
  assert.equal(none.totals.declared, 0);
  assert.ok(half.totals.declared > 150 && half.totals.declared < 190);
  assert.equal(all.totals.declared, 345);
  assert.equal(tally(all).reduce((n, r) => n + r.won, 0), 345);
});

test("majority is more than half", () => {
  assert.equal(majorityOf(9), 5);
  assert.equal(majorityOf(10), 6);
});

test("checks hold impossible updates and pass normal ones", () => {
  const a = rehearsalSnapshot(30);
  const b = rehearsalSnapshot(40);
  assert.equal(checkSnapshot(a, b, { expectedSeats: 345 }).ok, true);
  assert.equal(checkSnapshot(b, a, { expectedSeats: 345 }).ok, false); // declared count went down
  assert.equal(checkSnapshot(a, b, { expectedSeats: 300 }).ok, false); // wrong seat total
  assert.equal(checkSnapshot(null, { units: [], totals: { seats: 0, declared: 0 } }, {}).ok, false);
});

test("milestones post each thing once and only use declared seats", () => {
  const snap = rehearsalSnapshot(100);
  const first = detectMilestones(snap, new Set());
  assert.ok(first.events.some((e) => e.kind === "overall"));
  assert.equal(first.events[0].kind, "overall"); // biggest news first
  const posted = new Set([...first.events.map((e) => e.key), ...first.skip]);
  assert.equal(detectMilestones(snap, posted).events.length, 0);
  assert.equal(detectMilestones(rehearsalSnapshot(0), new Set()).events.length, 0);
});

test("counting window", () => {
  const cfg = { enabled: true, window: { from: "2026-12-02T06:00:00+05:30", to: "2026-12-03T06:00:00+05:30" } };
  assert.equal(inWindow(cfg, Date.parse("2026-12-02T12:00:00+05:30")), true);
  assert.equal(inWindow(cfg, Date.parse("2026-12-01T12:00:00+05:30")), false);
  assert.equal(isLive({ ...cfg, enabled: false }, Date.parse("2026-12-02T12:00:00+05:30")), false);
});

test("refresh does nothing when switched off or outside the window, and respects pause", async () => {
  const db = mem();
  const cfg = { slug: "t", enabled: false, window: {}, source: {} };
  assert.equal((await refreshResults(cfg, { db })).status, "disabled");
  assert.equal((await refreshResults({ ...cfg, enabled: true, window: { from: "2030-01-01T00:00:00Z", to: "2030-01-02T00:00:00Z" } }, { db })).status, "outside");
  await db.setSetting("results_meta_t", { paused: true });
  assert.equal((await refreshResults({ ...cfg, enabled: true, window: {} }, { db })).status, "paused");
});

test("a failing portal keeps the last good data and records the problem", async () => {
  const db = mem();
  await db.setSetting("results_t", { keep: "me" });
  const cfg = { slug: "t", enabled: true, window: {}, pollSeconds: 1, source: { base: "https://x.invalid", keys: { results: "a", summary: "b", time: "c" } } };
  const r = await refreshResults(cfg, { db, force: true, fetchFn: async () => { throw new Error("down"); } });
  assert.equal(r.status, "failed");
  assert.deepEqual(await db.getSetting("results_t"), { keep: "me" });
  assert.match((await db.getSetting("results_meta_t")).lastError, /down/);
});

test("captions credit the source and never claim projections", () => {
  const e = detectMilestones(rehearsalSnapshot(100), new Set()).events[0];
  const cap = captionFor({ slug: "x", title: "T" }, e);
  assert.match(cap, /State Election Commission/i);
  assert.doesNotMatch(cap, /project|trend|lead(s|ing)/i);
});
