// Plan B: manual entry. If the official portal cannot be read on counting day, the admin types each declared seat on
// /admin/results. The typed seats are turned into the same snapshot the portal would give, so the public page, the
// panel and the social posts all work unchanged. Kept in site settings as results_manual_<slug> = { on, entries }.
import { partyColour } from "./model.js";

export const manualKey = (slug) => `results_manual_${slug}`;

export async function loadManual(db, slug) {
  const m = (await db.getSetting(manualKey(slug)).catch(() => null)) || {};
  return { on: Boolean(m.on), entries: Array.isArray(m.entries) ? m.entries : [] };
}

const clean = (v, max) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const votes = (v) => {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
};

// Checks one typed seat. Returns { ok, entry } or { ok: false, error }.
export function cleanEntry(input, now = Date.now()) {
  const unit = clean(input.unit, 80);
  const seat = clean(input.seat, 80);
  const winnerName = clean(input.winnerName, 80);
  const winnerParty = clean(input.winnerParty, 30).toUpperCase();
  const winnerVotes = votes(input.winnerVotes);
  const runnerName = clean(input.runnerName, 80);
  const runnerParty = clean(input.runnerParty, 30).toUpperCase();
  const runnerVotes = runnerName ? votes(input.runnerVotes) : null;
  if (!unit) return { ok: false, error: "Enter the ward group or area name (e.g. Agartala MC Ward 1-5)." };
  if (!seat) return { ok: false, error: "Enter the seat or ward name." };
  if (!winnerName || !winnerParty) return { ok: false, error: "Enter the winner's name and party." };
  if (winnerVotes === null) return { ok: false, error: "Winner's votes must be a whole number." };
  if (runnerName && (runnerVotes === null || !runnerParty)) return { ok: false, error: "Runner-up needs a name, party and whole-number votes, or leave all runner-up boxes empty." };
  if (runnerVotes !== null && runnerVotes > winnerVotes) return { ok: false, error: "The winner must have at least as many votes as the runner-up. Check the figures." };
  return {
    ok: true,
    entry: {
      id: `${unit}|${seat}`,
      unit,
      seat,
      winnerName,
      winnerParty,
      winnerVotes,
      runnerName: runnerName || null,
      runnerParty: runnerName ? runnerParty : null,
      runnerVotes,
      verified: input.verified !== false,
      at: new Date(now).toISOString(),
    },
  };
}

// Adds a seat, or replaces the one already typed for the same unit and seat (that is how a mistake is corrected).
export function upsertEntry(entries, entry) {
  const i = entries.findIndex((e) => e.id === entry.id);
  if (i < 0) return [...entries, entry];
  const next = entries.slice();
  next[i] = entry;
  return next;
}

// Turns the typed seats into a results snapshot. totals.seats is the known seat count (expectedSeats), so the progress
// bar reads "x of total". Unit totals show the seats typed for that unit so far.
export function snapshotFromManual(entries, { slug, expectedSeats = 0, now = new Date().toISOString() } = {}) {
  const byUnit = new Map();
  for (const e of entries) {
    if (!byUnit.has(e.unit)) byUnit.set(e.unit, []);
    byUnit.get(e.unit).push(e);
  }
  const units = [...byUnit].map(([name, list], i) => {
    const seats = list.map((e) => ({
      id: e.id,
      name: e.seat,
      declared: true,
      verified: e.verified !== false,
      at: e.at || now,
      winner: { name: e.winnerName, party: e.winnerParty, votes: e.winnerVotes },
      runnerUp: e.runnerName ? { name: e.runnerName, party: e.runnerParty, votes: e.runnerVotes } : null,
      margin: e.runnerName ? e.winnerVotes - e.runnerVotes : null,
      candidates: e.runnerName ? 2 : 1,
    }));
    return { id: `manual-${i}`, name, path: name, total: seats.length, declared: seats.length, seats };
  });
  const keys = new Set();
  for (const e of entries) {
    keys.add(e.winnerParty);
    if (e.runnerParty) keys.add(e.runnerParty);
  }
  const parties = [...keys].map((key) => ({ key, name: key, full: key, colour: partyColour(key) }));
  const seatsTotal = expectedSeats || entries.length;
  return {
    slug,
    source: { updatedLabel: "Entered by hand from the official count", fetchedAt: now },
    parties,
    units,
    totals: { seats: seatsTotal, declared: entries.length, verified: entries.filter((e) => e.verified !== false).length },
  };
}
