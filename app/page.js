import { db } from "../lib/db.js";
import { settings, generalRegion, states, northeastRegions, widerRegions, topics } from "../lib/config.js";
import { latestVideos } from "../lib/youtube.js";
import { capitalsWeather } from "../lib/weather.js";
import { WeatherStrip, PageShell, LeadStory, LatestList, CategoryBlock, StatesBoxes, SectionHead, StoryGrid, Videos, categoryUrl } from "./components.js";
import { LiveUpdates } from "./client.js";

// Always fresh: a story appears the moment you press APPROVE.
export const dynamic = "force-dynamic";

// The newest story from each different state first, so no single state fills the section.
function acrossTheRegion(stories, count) {
  const picked = [];
  const seen = new Set();
  for (const s of stories) if (!seen.has(s.region) && picked.length < count) (seen.add(s.region), picked.push(s));
  for (const s of stories) if (!picked.includes(s) && picked.length < count) picked.push(s);
  return picked;
}

export default async function HomePage() {
  const [stories, videos, mostRead, weather] = await Promise.all([
    db.listStories({ status: "approved", limit: 100 }),
    latestVideos(4),
    db.mostRead(1, 5).catch(() => []),
    capitalsWeather(),
  ]);

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
  const storiesByState = states.map((state) => [state, others.filter((s) => s.region === state).slice(0, 3)]);

  return (
    <PageShell ticker={stories.slice(0, 10)} updatedAt={stories[0].published_at}>
      <LiveUpdates since={stories[0].published_at} />
      <h1 className="sr-only">{settings.siteName}: {settings.tagline}</h1>

      <WeatherStrip weather={weather} />

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

      {mostRead.length >= 3 && (
        <section className="section">
          <LatestList stories={mostRead} title="Most read today" />
        </section>
      )}

      <CategoryBlock title={`Across the ${generalRegion}`} href={categoryUrl(generalRegion)} stories={acrossTheRegion(others.filter((s) => northeastRegions.includes(s.region)), 5)} />

      <StatesBoxes storiesByState={storiesByState} />

      {widerRegions.map((r) => (
        <CategoryBlock key={r} title={r} stories={others.filter((s) => s.region === r).slice(0, 5)} />
      ))}

      <Videos videos={videos} />

      {topics.map((t) => (
        <CategoryBlock key={t} title={t} stories={others.filter((s) => s.topic === t).slice(0, 5)} />
      ))}
    </PageShell>
  );
}
