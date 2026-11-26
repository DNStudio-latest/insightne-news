// Voter turnout updates for polling day. The results portal does not publish turnout, so the figures are typed in on
// /admin/results from the State Election Commission's official updates (press notes / its posts) and shown on the panel.
// Kept in site settings: turnout_<slug> = { updates: [{ at, label, percent, note }] } (oldest first).
export const loadTurnout = async (db, slug) => ({ updates: [], ...((await db.getSetting(`turnout_${slug}`).catch(() => null)) || {}) });

export function pollingOpen(cfg, now = Date.now()) {
  const w = cfg?.polling?.window;
  if (!w?.from || !w?.to) return false;
  return now >= Date.parse(w.from) && now < Date.parse(w.to);
}

// Where polling stands on the polling day (India time): "upcoming" before 7 am, "open" 7 am to 4 pm, "closed" after 4 pm.
// The panel shows from midnight of the polling day, so readers see the start time before polls open. Null on other days.
export function pollStage(cfg, now = Date.now()) {
  const from = cfg?.polling?.window?.from;
  if (!from) return null;
  const day = from.slice(0, 10);
  const dayStart = Date.parse(day + "T00:00:00+05:30");
  if (now < dayStart || now >= dayStart + 86400000) return null;
  if (now < Date.parse(day + "T07:00:00+05:30")) return "upcoming";
  if (now < Date.parse(day + "T16:00:00+05:30")) return "open";
  return "closed";
}

// Adds one update. Turnout can only go up through the day; a lower figure or a figure above 100 is refused.
export function addTurnoutUpdate(turnout, { label, percent, note = "" }, now = Date.now()) {
  const pct = Number(percent);
  const last = turnout.updates.at(-1);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return { ok: false, error: "Turnout must be between 0 and 100." };
  if (!String(label || "").trim()) return { ok: false, error: "Say what time the figure is for, e.g. 1 pm." };
  if (last && pct < last.percent) return { ok: false, error: `That is lower than the last figure (${last.percent}%). Turnout cannot fall.` };
  const row = { at: new Date(now).toISOString(), label: String(label).trim().slice(0, 40), percent: Math.round(pct * 100) / 100, note: String(note || "").trim().slice(0, 120) };
  return { ok: true, turnout: { ...turnout, updates: [...turnout.updates, row].slice(-40) } };
}
