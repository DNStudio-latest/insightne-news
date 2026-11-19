// The InsightNE "Result" poster for the live counting: /poster/result/<election>?kind=tally|majority|unit|contest
// [&unit=<id>][&seat=<id>][&shape=landscape|portrait|wide|square][&format=jpg]. Everything on it comes from the stored
// results (lib/results), never from AI wording. English only. "rehearsal" (admin only) draws the practice counting day at
// ?pct=NN instead; it is never posted.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { db } from "../../../../lib/db.js";
import { settings } from "../../../../lib/config.js";
import { currentRole } from "../../../../lib/auth.js";
import { electionConfig, loadSnapshot } from "../../../../lib/results/store.js";
import { rehearsalSnapshot } from "../../../../lib/results/replay.js";
import { tally, progress, majorityOf, marginText } from "../../../../lib/results/model.js";

export const dynamic = "force-dynamic";

const NAVY = "#0a2540";
const YELLOW = "#ffd400";
const RED = "#e53935";
const SHAPES = { wide: [1920, 1080], landscape: [1910, 1000], portrait: [1080, 1350], square: [1080, 1080] };
const font = (file) => readFile(path.join(process.cwd(), "assets", "fonts", file));

// What the poster says: a heading, a line under it, and the bars (one per party, or the two candidates of a seat).
function content(snapshot, query) {
  const kind = query.get("kind") || "tally";
  const unit = snapshot.units.find((u) => u.id === query.get("unit")) || null;
  if (kind === "contest" && unit) {
    const seat = unit.seats.find((s) => s.id === query.get("seat"));
    if (seat?.declared && seat.winner) {
      const rows = [seat.winner, seat.runnerUp].filter(Boolean).map((c) => ({ label: `${c.name} (${c.party})`, value: c.votes, text: c.votes.toLocaleString("en-IN"), colour: snapshot.parties.find((p) => p.key === c.party)?.colour || "#9e9e9e" }));
      return { head: seat.name.toUpperCase(), sub: `${unit.name} · Won by ${marginText(seat)}`, rows, tag: "RESULT" };
    }
  }
  if (kind === "majority" && unit) {
    const rows = tally(snapshot, unit);
    const lead = rows[0];
    return { head: `${lead?.name || ""} CROSSES MAJORITY`, sub: `${unit.name} · ${lead?.won} of ${unit.total} seats · majority mark ${majorityOf(unit.total)}`, rows: rows.slice(0, 5).map((r) => ({ label: r.name, value: r.won, text: String(r.won), colour: r.colour })), tag: "LIVE COUNTING" };
  }
  if (kind === "unit" && unit) {
    return { head: "FINAL RESULT", sub: `${unit.name} · ${unit.total} seats`, rows: tally(snapshot, unit).slice(0, 5).map((r) => ({ label: r.name, value: r.won, text: String(r.won), colour: r.colour })), tag: "RESULT" };
  }
  const p = progress(snapshot);
  return { head: p.declared === p.seats ? "ALL RESULTS DECLARED" : "COUNTING UPDATE", sub: `${p.declared} of ${p.seats} seats declared (${p.pct}%)`, rows: tally(snapshot).slice(0, 5).map((r) => ({ label: r.name, value: r.won, text: String(r.won), colour: r.colour })), tag: p.declared === p.seats ? "FINAL" : "LIVE COUNTING" };
}

export async function GET(request, { params }) {
  const { election } = await params;
  const query = new URL(request.url).searchParams;
  let snapshot;
  let cfg = null;
  if (election === "rehearsal") {
    if ((await currentRole()) !== "admin") return new Response("Admin only", { status: 403 });
    snapshot = rehearsalSnapshot(query.get("pct"));
  } else {
    cfg = await electionConfig(db, election);
    snapshot = cfg && (await loadSnapshot(db, election));
  }
  if (!snapshot) return new Response("No results yet", { status: 404 });

  const [w, h] = SHAPES[query.get("shape")] || SHAPES.landscape;
  const tall = h > w * 0.9;
  const k = tall ? w / 1080 : w / 1910;
  const px = (n) => Math.round(n * k);
  const c = content(snapshot, query);
  const max = Math.max(1, ...c.rows.map((r) => r.value));
  const [sansBold, sans] = await Promise.all([font("noto-sans-latin-700-normal.woff"), font("noto-sans-latin-500-normal.woff")]);
  const link = `${settings.siteUrl.replace(/^https?:\/\/(www\.)?/, "")}/results/${election === "rehearsal" ? "…" : election}`;
  const rowH = tall ? 92 : px(86);

  const picture = new ImageResponse(
    (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "column", background: "linear-gradient(180deg, #0d2f56 0%, #071a30 100%)", fontFamily: "Sans", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${px(40)}px ${px(56)}px 0` }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", background: RED, fontSize: px(34), fontWeight: 700, padding: `${px(8)}px ${px(22)}px`, letterSpacing: 3 }}>● {c.tag}</div>
            <div style={{ display: "flex", background: YELLOW, color: NAVY, fontSize: px(30), fontWeight: 700, padding: `${px(8)}px ${px(20)}px`, marginLeft: px(14), letterSpacing: 1 }}>TRIPURA CIVIC POLLS</div>
          </div>
          <div style={{ display: "flex", fontSize: px(46), fontWeight: 700 }}>
            InsightNE<span style={{ color: YELLOW, marginLeft: px(12) }}>News</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: `${px(40)}px ${px(56)}px 0` }}>
          <div style={{ display: "flex", width: px(140), height: px(10), background: YELLOW, marginBottom: px(20) }} />
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: tall ? px(78) : px(84), fontWeight: 700, lineHeight: 1.08, textTransform: "uppercase" }}>{c.head}</div>
          <div style={{ display: "flex", fontSize: px(36), fontWeight: 500, color: "#cfe0f2", marginTop: px(16) }}>{c.sub}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", padding: `0 ${px(56)}px` }}>
          {c.rows.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", height: rowH, marginTop: i ? px(12) : 0 }}>
              <div style={{ display: "flex", width: tall ? px(330) : px(380), fontSize: px(36), fontWeight: 700 }}>{r.label}</div>
              <div style={{ display: "flex", flexGrow: 1, height: px(54), background: "rgba(255,255,255,0.12)" }}>
                <div style={{ display: "flex", width: `${Math.max(3, Math.round((r.value / max) * 100))}%`, height: px(54), background: r.colour }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", width: px(150), fontSize: px(56), fontWeight: 700 }}>{r.text}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", padding: `0 ${px(56)}px ${px(14)}px`, fontSize: px(22), color: "#9fb8d4" }}>
          <div style={{ display: "flex" }}>Source: State Election Commission, Tripura · as entered by Returning Officers · {snapshot.source?.updatedLabel || ""}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: px(80), padding: `0 ${px(56)}px`, background: YELLOW, color: NAVY, fontSize: px(34), fontWeight: 700 }}>
          <div style={{ display: "flex" }}>FOLLOW THE COUNTING LIVE</div>
          <div style={{ display: "flex" }}>{link}</div>
        </div>
      </div>
    ),
    { width: w, height: h, fonts: [{ name: "Sans", data: sansBold, weight: 700, style: "normal" }, { name: "Sans", data: sans, weight: 500, style: "normal" }], headers: { "Cache-Control": "no-store" } },
  );
  if (query.get("format") !== "jpg") return picture;
  const jpeg = await sharp(Buffer.from(await picture.arrayBuffer())).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return new Response(jpeg, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" } });
}
