import { redirect } from "next/navigation";
import { db } from "../../../lib/db.js";
import { currentRole } from "../../../lib/auth.js";
import { formatDate } from "../../../lib/format.js";
import { elections, electionConfig, loadSnapshot, loadMeta, isLive } from "../../../lib/results/store.js";
import { saveElectionSettings, setPaused, fetchNow, resetPosted } from "./actions.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live results", robots: { index: false, follow: false } };

export default async function ResultsAdminPage() {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "admin") redirect("/admin");
  const rows = await Promise.all(
    elections().map(async (e) => {
      const cfg = await electionConfig(db, e.slug);
      const [snap, meta] = await Promise.all([loadSnapshot(db, e.slug), loadMeta(db, e.slug)]);
      return { cfg, snap, meta };
    }),
  );
  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>🗳️ Live results</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      <p className="hint">Reads the official results portal during counting, shows it on the website and posts the big updates to Facebook and Instagram. Switch it on the evening before counting.</p>
      <p><a className="btn btn-plain" href="/admin/results/rehearsal">▶ Practice counting day (rehearsal)</a></p>
      {rows.map(({ cfg, snap, meta }) => (
        <section key={cfg.slug} className="run-box">
          <h2>{cfg.title}</h2>
          <p>
            Status: <strong>{!cfg.enabled ? "OFF" : meta.paused ? "PAUSED" : isLive(cfg) ? "LIVE (reading the portal)" : "ON, waiting for the counting window"}</strong>
            {snap && <> · {snap.totals.declared}/{snap.totals.seats} seats declared · last good read {meta.lastOkAt ? formatDate(new Date(meta.lastOkAt).toISOString()) : "-"}</>}
          </p>
          {meta.lastError && <p style={{ color: "var(--danger)" }}>Last problem: {meta.lastError}</p>}
          {meta.issues?.length > 0 && <ul>{meta.issues.map((i, n) => <li key={n}>{i.level === "stop" ? "⛔" : "⚠️"} {i.text}</li>)}</ul>}
          <p><a href={`/results/${cfg.slug}`}>Open public page</a></p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <form action={setPaused}><input type="hidden" name="slug" value={cfg.slug} /><input type="hidden" name="paused" value={meta.paused ? "0" : "1"} /><button className="btn btn-plain" type="submit">{meta.paused ? "Resume updates" : "Pause updates"}</button></form>
            <form action={fetchNow}><input type="hidden" name="slug" value={cfg.slug} /><button className="btn btn-plain" type="submit">Read portal now (no posts)</button></form>
            <form action={fetchNow}><input type="hidden" name="slug" value={cfg.slug} /><input type="hidden" name="share" value="1" /><button className="btn btn-approve" type="submit">Read now and post</button></form>
            <form action={resetPosted}><input type="hidden" name="slug" value={cfg.slug} /><button className="btn btn-plain" type="submit">Forget posted updates</button></form>
          </div>

          <h3>Settings</h3>
          <form action={saveElectionSettings} className="stack">
            <input type="hidden" name="slug" value={cfg.slug} />
            <label><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} /> Reading switched ON</label>
            <label>Counting window starts (e.g. 2026-12-02T06:00:00+05:30)<input name="from" defaultValue={cfg.window?.from} /></label>
            <label>Counting window ends<input name="to" defaultValue={cfg.window?.to} /></label>
            <label>Total seats expected (bad reads are held if this differs)<input name="expectedSeats" type="number" defaultValue={cfg.expectedSeats} /></label>
            <label>Portal address<input name="base" defaultValue={cfg.source.base} /></label>
            <label>Portal key: results<input name="kResults" defaultValue={cfg.source.keys.results} /></label>
            <label>Portal key: summary<input name="kSummary" defaultValue={cfg.source.keys.summary} /></label>
            <label>Portal key: time<input name="kTime" defaultValue={cfg.source.keys.time} /></label>
            <label>Key contests to post (one seat id or name per line)<textarea name="keyContests" rows={3} defaultValue={(cfg.keyContests || []).join("\n")} /></label>
            <label><input type="checkbox" name="socialOn" defaultChecked={cfg.social?.enabled} /> Post big updates to Facebook and Instagram</label>
            <label>Most posts per network per day<input name="maxPerDay" type="number" defaultValue={cfg.social?.maxPerDay} /></label>
            <button className="btn btn-approve" type="submit">Save settings</button>
          </form>

          <h3>Recent updates</h3>
          {meta.events?.length ? <ul>{meta.events.slice(0, 12).map((e, i) => <li key={i}>{e.title || e.key}: Facebook {e.facebook || e.error || "-"}, Instagram {e.instagram || "-"}</li>)}</ul> : <p className="note">None yet.</p>}
        </section>
      ))}
    </div>
  );
}
