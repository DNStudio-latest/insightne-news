// Admin-only check of the cricket score feed. It reads the same feed as the homepage score box,
// and shows match names and status only. It never shows the key and changes nothing on the site.
import { redirect } from "next/navigation";
import { currentRole } from "../../../lib/auth.js";
import { cricketReady, cleanMatch, pickIndiaMatch } from "../../../lib/cricket.js";
import { settings } from "../../../lib/config.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cricket feed check", robots: { index: false, follow: false } };

async function feed() {
  const res = await fetch(`https://api.cricapi.com/v1/currentMatches?apikey=${encodeURIComponent(process.env.CRICKETDATA_API_KEY || "")}&offset=0`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
  return { http: res.status, data: await res.json().catch(() => ({})) };
}

export default async function CricketCheck() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "admin") redirect("/admin");

  const ready = cricketReady();
  let body;
  if (!ready) {
    body = <p>CRICKETDATA_API_KEY is not set on this site (Vercel). Add it, then redeploy.</p>;
  } else {
    const { http, data } = await feed().catch((err) => ({ http: 0, data: { reason: err.message } }));
    const matches = (data.data || []).map(cleanMatch);
    const picked = pickIndiaMatch(data.data || []);
    body = (
      <>
        <p>
          Feed answer: HTTP {http}, status {data.status || "unknown"}
          {data.reason ? ` (${data.reason})` : ""}. Matches in the feed: {matches.length}.
        </p>
        <p>
          Opponent the box follows: <b>{settings.cricket?.followOpponent || "any (no filter)"}</b>. Match picked for the box:{" "}
          <b>{picked ? picked.name : "none"}</b>.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Teams</th>
              <th>Starts (GMT)</th>
              <th>Live</th>
              <th>Ended</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.teams.map((t) => t.name).join(" v ")}</td>
                <td>{m.startsAt || "?"}</td>
                <td>{m.live ? "yes" : "no"}</td>
                <td>{m.ended ? "yes" : "no"}</td>
                <td>{m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>🏏 Cricket feed check</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      {body}
    </div>
  );
}
