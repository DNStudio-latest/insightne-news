// The standard form of election results on this site, and the helpers that read it.
// A snapshot is: { slug, source: { updatedLabel, fetchedAt }, parties: [{ key, name, full, colour }],
//   units: [{ id, name, path, total, declared, seats: [seat] }], totals: { seats, declared, verified } }
// A unit is a ward group, municipality, block or village committee: whatever directly holds a list of seats (wards).
// A seat is { id, name, declared, verified, at, winner: { name, party, votes } | null, runnerUp: { ... } | null, margin, candidates }.
// Only what the official source has marked as declared is ever shown as won.

const NAMED = /_name$/;
const NOT_A_PLACE = /^(party|candidate|winning|sign|declared|verified|symbol|constituency)/;

// "rgb( 218, 202, 44)" -> "#daca2c"
export function rgbToHex(text) {
  const m = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i.exec(String(text || ""));
  return m ? `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}` : null;
}

const COLOURS = { BJP: "#ff9933", TMP: "#e6c800", "CPI(M)": "#d32f2f", CPIM: "#d32f2f", INC: "#1e88e5", TMC: "#2e9d4f", AITC: "#2e9d4f", INDEPENDENT: "#9e9e9e", IND: "#9e9e9e" };
export function partyColour(key, given) {
  const hex = rgbToHex(given) || (/^#[0-9a-f]{6}$/i.test(given || "") ? given : null);
  if (hex) return hex;
  if (COLOURS[String(key).toUpperCase()]) return COLOURS[String(key).toUpperCase()];
  let h = 0;
  for (const c of String(key)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 50%)`;
}

export const majorityOf = (total) => Math.floor(total / 2) + 1;

const placeName = (node) => {
  const k = Object.keys(node).find((key) => NAMED.test(key) && !NOT_A_PLACE.test(key));
  return k ? String(node[k]) : "";
};
const placeId = (node, fallback) => {
  const k = Object.keys(node).find((key) => NAMED.test(key) && !NOT_A_PLACE.test(key));
  const idKey = k ? k.replace(/_name$/, "_id") : null;
  return String(idKey && node[idKey] != null ? node[idKey] : fallback);
};

function parseSeat(c, unitId, index) {
  const all = (c.candidate_data || []).map((x) => ({ name: String(x.candidate_name || "").trim(), party: String(x.party_name || "").trim() || "IND", votes: Number(x.vote_secured) || 0, winner: Number(x.is_winner) === 1 || x.is_winner === true, nota: Number(x.is_nota) === 1 }));
  const real = all.filter((x) => !x.nota);
  const declared = Boolean(c.is_declared);
  const win = declared ? real.find((x) => x.winner) || null : null;
  const others = real.filter((x) => x !== win).sort((a, b) => b.votes - a.votes);
  const runnerUp = win ? others[0] || null : null;
  const pick = (x) => (x ? { name: x.name, party: x.party, votes: x.votes } : null);
  return {
    id: String(c.constituency_code ?? `${unitId}-${index}`),
    name: String(c.constituency_no_name || `Seat ${index + 1}`),
    declared,
    verified: Boolean(c.is_verified),
    at: null,
    winner: pick(win),
    runnerUp: pick(runnerUp),
    margin: win && runnerUp ? win.votes - runnerUp.votes : null,
    candidates: real.length,
  };
}

// results: the portal's list of districts / blocks / village committees / seats (any depth). summary: the portal's party list
// (names, full names, colours). Finds every group that directly holds seats, whatever its level is called.
export function normaliseResults(results, summary, { slug, updatedLabel = "", now = new Date().toISOString() } = {}) {
  const units = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((n) => walk(n, path));
    if (!node || typeof node !== "object" || Array.isArray(node.candidate_data)) return;
    const name = placeName(node);
    const here = name ? [...path, name] : path;
    const seatList = Object.values(node).find((v) => Array.isArray(v) && v.length && v[0] && Array.isArray(v[0].candidate_data));
    if (seatList) {
      const id = placeId(node, here.join("/"));
      const seats = seatList.map((c, i) => parseSeat(c, id, i));
      units.push({ id, name: name || "Seats", path: path.join(" › "), total: seats.length, declared: seats.filter((s) => s.declared).length, seats });
      return;
    }
    for (const v of Object.values(node)) if (Array.isArray(v)) walk(v, here);
  };
  walk(results, []);

  const named = new Map();
  for (const p of summary?.party_wise_results || []) named.set(String(p.party_name).trim(), p);
  const keys = new Set();
  for (const u of units) for (const s of u.seats) for (const p of [s.winner?.party, s.runnerUp?.party]) if (p) keys.add(p);
  for (const k of named.keys()) keys.add(k);
  const parties = [...keys].map((key) => ({ key, name: key, full: named.get(key)?.party_full_name || key, colour: partyColour(key, named.get(key)?.party_colour_code) }));

  const seats = units.reduce((n, u) => n + u.total, 0);
  const declared = units.reduce((n, u) => n + u.declared, 0);
  const verified = units.reduce((n, u) => n + u.seats.filter((s) => s.declared && s.verified).length, 0);
  return { slug, source: { updatedLabel, fetchedAt: now }, parties, units, totals: { seats, declared, verified } };
}

// ---- what the pages and posts show, worked out from a snapshot ----

// Seats won per party (declared seats only), most first. only: a unit, or null for everything.
export function tally(snapshot, unit = null) {
  const counts = new Map();
  for (const u of unit ? [unit] : snapshot.units) for (const s of u.seats) if (s.declared && s.winner) counts.set(s.winner.party, (counts.get(s.winner.party) || 0) + 1);
  const total = unit ? unit.total : snapshot.totals.seats;
  return [...counts.entries()]
    .map(([key, won]) => {
      const p = snapshot.parties.find((x) => x.key === key);
      return { key, name: key, full: p?.full || key, colour: p?.colour || partyColour(key), won, share: total ? won / total : 0 };
    })
    .sort((a, b) => b.won - a.won || a.name.localeCompare(b.name));
}

export function progress(snapshot) {
  const { seats, declared } = snapshot.totals;
  return { seats, declared, counting: Math.max(0, seats - declared), pct: seats ? Math.round((declared / seats) * 1000) / 10 : 0 };
}

const allSeats = (snapshot) => snapshot.units.flatMap((u) => u.seats.map((s) => ({ ...s, unit: u.name, unitId: u.id, path: u.path })));

// The most recently declared seats (newest first).
export function latestDeclared(snapshot, n = 8) {
  return allSeats(snapshot)
    .filter((s) => s.declared && s.winner)
    .sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")))
    .slice(0, n);
}

// The narrowest declared wins (smallest margin first).
export function closeContests(snapshot, n = 5) {
  return allSeats(snapshot)
    .filter((s) => s.declared && s.winner && s.margin != null)
    .sort((a, b) => a.margin - b.margin)
    .slice(0, n);
}

export const marginText = (s) => (s.margin == null ? "" : s.margin === 0 ? "level on votes" : `${s.margin.toLocaleString("en-IN")} votes`);
