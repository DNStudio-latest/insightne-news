// The practice counting day as JSON (admin only): /api/results/rehearsal?pct=NN. Also lists the social posts that would go
// out at that point (nothing is ever posted from here).
import { currentRole } from "../../../../lib/auth.js";
import { rehearsalSnapshot } from "../../../../lib/results/replay.js";
import { detectMilestones } from "../../../../lib/results/milestones.js";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if ((await currentRole()) !== "admin") return Response.json({ error: "admin only" }, { status: 403 });
  const pct = Number(new URL(request.url).searchParams.get("pct")) || 0;
  const snapshot = rehearsalSnapshot(pct);
  const { events } = detectMilestones(snapshot, new Set());
  return Response.json(
    {
      election: { slug: "rehearsal", title: "REHEARSAL: practice counting day", subtitle: "A finished election's results, played back. Not live. Never published or posted.", enabled: true, live: pct > 0 && pct < 100, countingDate: "" },
      snapshot,
      status: { paused: false, delayed: false },
      wouldPost: events.slice(0, 12).map((e) => ({ key: e.key, kind: e.kind, title: e.title, text: e.text, poster: e.poster })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
