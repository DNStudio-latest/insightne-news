// A practice counting day: the rehearsal sample (lib/results/fixtures, a finished election's results with names removed) is
// declared seat by seat in a fixed order, so the live page and the social posts can be tried out well before the real
// counting. Used only on /admin/results/rehearsal (admin only); nothing here is ever published or posted.
import fixture from "./fixtures/village-committee-2026.json" with { type: "json" };
import { normaliseResults } from "./model.js";

let full;
const base = () => (full ||= normaliseResults(fixture.results, fixture.summary, { slug: "rehearsal", updatedLabel: "" }));

const hash = (s) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
};

// pct: 0-100, the share of seats declared so far. Seats are declared in a fixed shuffled order, 30 seconds apart.
export function rehearsalSnapshot(pct, { startAt = Date.UTC(2026, 11, 2, 4, 30) } = {}) {
  const all = base();
  const order = all.units.flatMap((u) => u.seats.map((s) => ({ key: `${u.id}|${s.id}`, h: hash(`${u.id}|${s.id}`) }))).sort((a, b) => a.h - b.h);
  const rank = new Map(order.map((o, i) => [o.key, i]));
  const n = Math.round((Math.max(0, Math.min(100, Number(pct) || 0)) / 100) * order.length);
  const units = all.units.map((u) => {
    const seats = u.seats.map((s) => {
      const i = rank.get(`${u.id}|${s.id}`);
      return i < n ? { ...s, at: new Date(startAt + i * 30000).toISOString() } : { ...s, declared: false, at: null, winner: null, runnerUp: null, margin: null };
    });
    return { ...u, seats, declared: seats.filter((s) => s.declared).length };
  });
  const declared = units.reduce((a, u) => a + u.declared, 0);
  const now = new Date(startAt + n * 30000);
  return {
    ...all,
    units,
    totals: { seats: all.totals.seats, declared, verified: declared },
    source: { updatedLabel: `02-12-2026 ${now.toISOString().slice(11, 16)} (rehearsal)`, fetchedAt: now.toISOString() },
  };
}
