import { db } from "../lib/db.js";
import { settings } from "../lib/config.js";
import { latestVideos } from "../lib/youtube.js";
import { PageShell, LeadStory, LatestList, CategoryBlock, SectionHead, StoryGrid, Videos } from "./components.js";
import { LiveUpdates } from "./client.js";

// Always fresh: a story appears the moment you press APPROVE.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [stories, videos] = await Promise.all([db.listStories({ status: "approved", limit: 80 }), latestVideos(4)]);

  if (!stories.length) {
    return (
      <PageShell>
        <div className="empty">No stories here yet. Please check back soon.</div>
        <Videos videos={videos} />
      </PageShell>
    );
  }

  const lead = stories.find((s) => s.is_lead) || stories.find((s) => s.kind === "original" && s.image_url) || stories[0];
  const others = stories.filter((s) => s.id !== lead.id);
  const latest = others.slice(0, 8);
  const originals = others.filter((s) => s.kind === "original").slice(0, 3);
  const byCategory = (name) =>
    others.filter((s) => (settings.regions.includes(name) ? s.region === name : s.topic === name)).slice(0, 5);

  return (
    <PageShell ticker={stories.slice(0, 10)} updatedAt={stories[0].published_at}>
      <LiveUpdates since={stories[0].published_at} />
      <h1 className="sr-only">{settings.siteName}: {settings.tagline}</h1>

      <div className="front-top">
        <LeadStory story={lead} />
        <LatestList stories={latest} />
      </div>

      {originals.length > 0 && (
        <section className="section">
          <SectionHead title="InsightNE Originals" href="/originals" />
          <StoryGrid stories={originals} columns={3} />
        </section>
      )}

      {settings.regions.map((r) => (
        <CategoryBlock key={r} title={r} stories={byCategory(r)} />
      ))}

      <Videos videos={videos} />

      {settings.topics.map((t) => (
        <CategoryBlock key={t} title={t} stories={byCategory(t)} />
      ))}
    </PageShell>
  );
}
