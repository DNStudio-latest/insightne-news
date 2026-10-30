// Live cricket score for India men's matches, from CricketData.org (free plan: 100 requests a day).
// Needs one secret setting: CRICKETDATA_API_KEY. Without it, the score box simply does not appear.
// The score is fetched at most once every 15 minutes (96 requests a day), shared by all readers.

import { settings } from "./config.js";

const REFRESH_SECONDS = 15 * 60;

export const cricketReady = () => Boolean(process.env.CRICKETDATA_API_KEY);

// Only the senior men's team: "India" exactly — not "India Women", "India A", "India U19", "India Legends"…
export const isIndiaMen = (match) => Array.isArray(match?.teams) && match.teams.some((t) => String(t).trim() === "India");

// A tidy version of one match for the page.
export function cleanMatch(m) {
  const teamInfo = Object.fromEntries((m.teamInfo || []).map((t) => [t.name, t]));
  const innings = (m.score || []).map((s) => {
    const team = (m.teams || []).find((t) => String(s.inning || "").startsWith(t)) || String(s.inning || "").replace(/ Inning.*$/i, "");
    return { team, short: teamInfo[team]?.shortname || team, runs: s.r, wickets: s.w, overs: s.o };
  });
  return {
    id: m.id,
    name: m.name,
    type: String(m.matchType || "").toUpperCase(),
    status: m.status || "",
    venue: m.venue || "",
    teams: (m.teams || []).map((t) => ({ name: t, short: teamInfo[t]?.shortname || t, img: teamInfo[t]?.img || null })),
    innings,
    live: Boolean(m.matchStarted) && !m.matchEnded,
    ended: Boolean(m.matchEnded),
    startsAt: m.dateTimeGMT ? `${m.dateTimeGMT}Z`.replace(/ZZ$/, "Z") : null,
  };
}

// The India men's match to show: a live one first, otherwise one that finished or starts within about a day.
export function pickIndiaMatch(matches, now = Date.now(), opponent = settings.cricket?.followOpponent) {
  const india = (matches || [])
    .filter(isIndiaMen)
    .map(cleanMatch)
    .filter((m) => !opponent || m.teams.some((t) => t.name === opponent)); // only the chosen opponent's matches
  const live = india.find((m) => m.live);
  if (live) return live;
  const near = (m) => m.startsAt && Math.abs(new Date(m.startsAt).getTime() - now) < 30 * 3600 * 1000;
  return india.find((m) => m.ended && near(m)) || india.find((m) => !m.ended && near(m)) || null;
}

export async function indiaMatch() {
  if (!cricketReady()) return null;
  try {
    const res = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(process.env.CRICKETDATA_API_KEY)}&offset=0`, {
      next: { revalidate: REFRESH_SECONDS },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== "success") return null;
    return pickIndiaMatch(data.data);
  } catch {
    return null; // If the score service is slow or down, the page simply shows no score.
  }
}
