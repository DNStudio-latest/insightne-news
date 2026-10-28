import { redirect } from "next/navigation";
import { db } from "../../../lib/db.js";
import { currentRole } from "../../../lib/auth.js";
import { formatDate } from "../../../lib/format.js";
import { currentLive, LIVE_HOURS } from "../../../lib/live.js";
import { settings } from "../../../lib/config.js";
import { goLive, endLive } from "../actions.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live broadcast", robots: { index: false, follow: false } };

export default async function LiveAdminPage({ searchParams }) {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "admin") redirect("/admin"); // admin only
  const { done } = await searchParams;
  const live = await currentLive(db);

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>🔴 Live broadcast</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      {done && <div className="notice">✓ {done}</div>}

      {live ? (
        <article className="story">
          <div className="meta">
            <span className="badge" style={{ background: "var(--danger)" }}>● ON THE WEBSITE NOW</span>
            <span>Since {formatDate(live.startedAt)} · ends by itself after {LIVE_HOURS} hours</span>
          </div>
          <h2>{live.title}</h2>
          <p className="byline">Source: {live.source}</p>
          <div className="video-embed">
            <iframe src={`https://www.youtube-nocookie.com/embed/${live.youtubeId}`} title={live.title} allow="encrypted-media; picture-in-picture" allowFullScreen />
          </div>
          <form action={endLive}>
            <button className="btn btn-reject" type="submit" style={{ width: "100%" }}>END LIVE</button>
          </form>
        </article>
      ) : (
        <p className="note">Nothing is live on the website now.</p>
      )}

      <form action={goLive} className="editor" style={{ marginTop: 16 }}>
        <h2 style={{ margin: 0 }}>{live ? "Switch to another broadcast" : "Go live"}</h2>
        <p className="hint" style={{ margin: 0 }}>
          Only use official live streams on YouTube (government offices, Doordarshan, Sansad TV…). On YouTube, open the live
          video, tap <b>Share → Copy link</b>, and paste it below. The video stays on YouTube; we only show their player.
        </p>
        <label>
          YouTube live link
          <input type="text" name="link" required placeholder="https://youtube.com/live/…  or  https://youtu.be/…" />
        </label>
        <label>
          Title for readers
          <input type="text" name="title" required maxLength={150} placeholder="e.g. Chief Minister addresses the state on Statehood Day" />
        </label>
        <label>
          Bengali title <span className="hint">— optional</span>
          <input type="text" name="title_bn" lang="bn" maxLength={200} />
        </label>
        <label>
          Source (who is broadcasting)
          <input type="text" name="source" maxLength={80} placeholder="e.g. Doordarshan, Sansad TV, CM's Office" />
        </label>
        <div className="editor-actions">
          <button className="btn btn-approve" type="submit">🔴 GO LIVE ON THE WEBSITE</button>
        </div>
      </form>

      <div className="run-box">
        <strong>Official channels to find live streams:</strong>
        <ul>
          {settings.liveChannels.list.map((c) => (
            <li key={c.url}><a href={c.url} target="_blank" rel="noopener noreferrer">{c.name} ↗</a></li>
          ))}
        </ul>
      </div>
    </div>
  );
}
