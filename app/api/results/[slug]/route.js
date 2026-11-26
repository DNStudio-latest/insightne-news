// The live results as JSON, for the live page to read every 20 seconds. Cached for 10 seconds at the edge, so thousands of
// readers cause only a handful of requests to the official portal. When the counting window is open, a request that
// reaches the server also asks lib/results/store.js whether the portal should be read again (at most once per interval).
import { after } from "next/server";
import { db } from "../../../../lib/db.js";
import { electionConfig, loadSnapshot, loadMeta, refreshResults, isLive } from "../../../../lib/results/store.js";
import { loadTurnout, pollingOpen } from "../../../../lib/results/turnout.js";
import { shareMilestones } from "../../../../lib/results/social.js";

export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { slug } = await params;
  const cfg = await electionConfig(db, slug);
  if (!cfg) return Response.json({ error: "not found" }, { status: 404 });
  const live = isLive(cfg);
  if (live) after(() => refreshResults(cfg, { db, shareFn: shareMilestones }));
  const [snapshot, meta, turnout] = await Promise.all([loadSnapshot(db, slug), loadMeta(db, slug), loadTurnout(db, slug)]);
  return Response.json(
    {
      turnout: { updates: turnout.updates.slice(-12).map(({ label, percent, note }) => ({ label, percent, note })), electors: cfg.polling?.electors || null, stations: cfg.polling?.stations || null, date: cfg.polling?.date || null },
      election: { slug, title: cfg.title, subtitle: cfg.subtitle, enabled: Boolean(cfg.enabled), live, polling: pollingOpen(cfg), countingDate: cfg.countingDate, window: cfg.window },
      snapshot: snapshot || null,
      // Only what readers need: no internal details.
      status: { paused: Boolean(meta.paused), delayed: Boolean(meta.lastError) && live, lastOkAt: meta.lastOkAt || null },
    },
    { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } },
  );
}
