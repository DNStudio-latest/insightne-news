// Which "big updates" are worth sharing on social media, worked out from the results. Only seats the official source has
// marked both declared AND verified count here, and every line of text is a fixed template filled with those numbers:
// nothing is written or guessed, and "won" is never said of a seat that is not declared.
import { tally, majorityOf } from "./model.js";

const ready = (s) => s.declared && s.verified && s.winner;
const votes = (n) => Number(n).toLocaleString("en-IN");
// " by 59 votes", or " after a tie on votes" (the official result names the winner).
const byText = (m) => (m == null ? "" : m === 0 ? " after a tie on votes" : ` by ${votes(m)} votes`);
const partyLine = (rows, n = 3) => rows.slice(0, n).map((r) => `${r.name} ${r.won}`).join(" · ");
const PRIORITY = { overall: 6, unit: 5, majority: 4, contest: 3, progress: 2, first: 1 };

// A snapshot of only the ready (declared and verified) seats, so the tallies in the posts never include unverified ones.
function verifiedOnly(snapshot) {
  const units = snapshot.units.map((u) => ({ ...u, seats: u.seats.map((s) => (ready(s) ? s : { ...s, declared: false, winner: null })) }));
  units.forEach((u) => (u.declared = u.seats.filter((s) => s.declared).length));
  return { ...snapshot, units, totals: { ...snapshot.totals, declared: units.reduce((n, u) => n + u.declared, 0) } };
}

// posted: a Set of milestone keys already shared. keyContests: names (or parts of names) of seats you want a post for.
// Returns { events, skip }: events to share (most important first); skip: keys to mark as done without posting (an earlier
// milestone that was passed before we could post it, so a late start does not flood the pages).
export function detectMilestones(snapshot, posted = new Set(), { keyContests = [] } = {}) {
  const v = verifiedOnly(snapshot);
  const total = v.totals.seats;
  const done = v.totals.declared;
  const events = [];
  const skip = [];
  const add = (key, kind, title, text, poster) => {
    if (!posted.has(key)) events.push({ key, kind, title, text, poster, priority: PRIORITY[kind] });
  };

  // The first result
  const firstSeat = v.units.flatMap((u) => u.seats.map((s) => ({ s, u }))).filter(({ s }) => s.declared).sort((a, b) => String(a.s.at || "").localeCompare(String(b.s.at || "")))[0];
  if (firstSeat && done <= 3 && !posted.has("first")) {
    const { s, u } = firstSeat;
    add("first", "first", "First result declared", `First result: ${s.name}, ${u.name}. ${s.winner.name} (${s.winner.party}) won${byText(s.margin)}.`, { kind: "tally" });
  } else if (firstSeat && done > 3 && !posted.has("first")) skip.push("first");

  // Progress: 25%, 50%, 75% of seats declared (only the highest one passed)
  if (total) {
    const crossed = [25, 50, 75].filter((t) => (done / total) * 100 >= t && !posted.has(`p${t}`));
    if (crossed.length) {
      const top = crossed[crossed.length - 1];
      crossed.slice(0, -1).forEach((t) => skip.push(`p${t}`));
      const rows = tally(v);
      add(`p${top}`, "progress", `${top}% of results declared`, `Counting update: ${done} of ${total} seats declared. ${partyLine(rows)}.`, { kind: "tally" });
    }
  }

  // A party passes the majority mark in a unit; a unit's final result; key contests
  for (const u of v.units) {
    if (u.total < 5) continue;
    const rows = tally(v, u);
    const need = majorityOf(u.total);
    for (const r of rows) if (r.won >= need) add(`majority:${u.id}:${r.key}`, "majority", `${r.name} crosses the majority mark in ${u.name}`, `${r.name} has crossed the majority mark in ${u.name}: ${r.won} of ${u.total} seats declared won (majority: ${need}).`, { kind: "majority", unit: u.id });
    if (u.declared === u.total) add(`unit:${u.id}`, "unit", `Final result: ${u.name}`, `Final result, ${u.name}: ${rows.map((r) => `${r.name} ${r.won}`).join(", ")} (of ${u.total} seats).`, { kind: "unit", unit: u.id });
  }
  const wanted = keyContests.map((k) => String(k).toLowerCase()).filter(Boolean);
  if (wanted.length) {
    for (const u of v.units) {
      for (const s of u.seats) {
        if (!s.declared || !wanted.some((k) => `${u.name} ${s.name}`.toLowerCase().includes(k) || s.id === k)) continue;
        const ru = s.runnerUp ? ` over ${s.runnerUp.name} (${s.runnerUp.party})` : "";
        add(`contest:${u.id}:${s.id}`, "contest", `Key contest: ${s.name}`, `${s.name}, ${u.name}: ${s.winner.name} (${s.winner.party}) won${byText(s.margin)}${ru}.`, { kind: "contest", unit: u.id, seat: s.id });
      }
    }
  }

  // Everything declared
  if (total && done === total) add("overall", "overall", "All results declared", `All ${total} seats declared. Final tally: ${partyLine(tally(v), 5)}.`, { kind: "tally" });

  events.sort((a, b) => b.priority - a.priority);
  return { events, skip };
}
