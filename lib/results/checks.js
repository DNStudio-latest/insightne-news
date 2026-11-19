// Safety checks on a new set of results before it replaces the one on the page. A "stop" problem keeps the last good
// results on screen (with "update delayed") and alerts the admin; a "warn" is applied but recorded for the admin.

// prev: the last good snapshot (or null). next: the new one. expectedSeats: the known total, if any.
export function checkSnapshot(prev, next, { expectedSeats = null } = {}) {
  const issues = [];
  const stop = (text) => issues.push({ level: "stop", text });
  const warn = (text) => issues.push({ level: "warn", text });

  if (!next || !next.units?.length || !next.totals?.seats) stop("The source returned no seats.");
  else {
    if (expectedSeats && next.totals.seats !== expectedSeats) stop(`The source lists ${next.totals.seats} seats, but ${expectedSeats} were expected.`);
    for (const u of next.units) if (u.declared > u.total) stop(`${u.name}: more declared than seats.`);
    for (const u of next.units) for (const s of u.seats) if (s.declared && !s.winner) warn(`${u.name} / ${s.name}: declared but no winner is named.`);
  }
  if (prev && next?.totals) {
    if (prev.totals.seats !== next.totals.seats) stop(`The number of seats changed from ${prev.totals.seats} to ${next.totals.seats}.`);
    if (next.totals.declared < prev.totals.declared) stop(`The declared count went down from ${prev.totals.declared} to ${next.totals.declared}.`);
    const before = new Map(prev.units.flatMap((u) => u.seats.map((s) => [`${u.id}|${s.id}`, s])));
    for (const u of next.units) {
      for (const s of u.seats) {
        const old = before.get(`${u.id}|${s.id}`);
        if (!old?.declared || !s.declared || !old.winner || !s.winner) continue;
        if (old.winner.party !== s.winner.party || old.winner.name !== s.winner.name) warn(`${u.name} / ${s.name}: the winner changed from ${old.winner.name} (${old.winner.party}) to ${s.winner.name} (${s.winner.party}).`);
        else if (s.winner.votes < old.winner.votes) warn(`${u.name} / ${s.name}: the winner's votes went down from ${old.winner.votes} to ${s.winner.votes}.`);
      }
    }
  }
  return { ok: !issues.some((i) => i.level === "stop"), issues };
}
