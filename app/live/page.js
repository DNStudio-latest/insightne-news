// Live TV: the official broadcast that is live now (chosen by the editor), and links to official government channels.
import { db } from "../../lib/db.js";
import { settings } from "../../lib/config.js";
import { currentLive } from "../../lib/live.js";
import { PageShell, SectionHead, LivePlayer } from "../components.js";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Live TV",
  description: "Watch live official government programmes and broadcasts on InsightNE News.",
  alternates: { canonical: "/live" },
};

export default async function LivePage() {
  const live = await currentLive(db);
  return (
    <PageShell current="Live">
      <SectionHead title="Live TV" />
      {live ? <LivePlayer live={live} big /> : <div className="empty">Nothing is live right now. Important official programmes appear here when they are broadcast.</div>}
      <section className="section">
        <h2 className="section-title">Official channels</h2>
        <ul className="hl-list">
          {settings.liveChannels.list.map((c) => (
            <li key={c.url}>
              <a className="h-link" href={c.url} target="_blank" rel="noopener noreferrer">{c.name} ↗</a>
            </li>
          ))}
        </ul>
        <p className="note">These links open the channels' own pages on YouTube.</p>
      </section>
    </PageShell>
  );
}
