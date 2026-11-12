// A topic page for a running story (see hubs.json): a short timeline of checked facts, then every matching story.
import { notFound } from "next/navigation";
import { site } from "../../../../lib/site-cache.js";
import { hubBySlug, storyInHub } from "../../../../lib/hubs.js";
import { initLang, tr } from "../../../../lib/lang.js";
import { alternatesFor } from "../../../../lib/seo.js";
import { PageShell, SectionHead, StoryGrid } from "../../../components.js";

export const revalidate = 60; // kept ready by the website for a minute at a time
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }) {
  const { lang, slug } = await params;
  const hub = hubBySlug(slug);
  if (!hub) return { title: "Not found" };
  // The page text is English, so other languages stay out of search results.
  return { title: hub.title, description: hub.intro, alternates: alternatesFor(lang, `/topic/${slug}`, { translated: lang === "en" }), ...(lang === "en" ? {} : { robots: { index: false, follow: true } }) };
}

export default async function TopicPage({ params }) {
  const { lang, slug } = await params;
  await initLang(lang);
  const hub = hubBySlug(slug);
  if (!hub) notFound();
  const pool = await site.listStories({ status: "approved", limit: 300 });
  const stories = pool.filter((s) => storyInHub(s, hub)).slice(0, 60);
  return (
    <PageShell>
      <div className="page">
        <h1>{hub.title}</h1>
        <p>{hub.intro}</p>
        {hub.facts?.length > 0 && (
          <section className="section">
            <SectionHead title={hub.factsTitle || "Key dates"} />
            <ul>
              {hub.facts.map((f) => (
                <li key={f.date}><strong>{f.date}:</strong> {f.text}</li>
              ))}
            </ul>
            {hub.factsNote && <p className="note">{hub.factsNote}</p>}
          </section>
        )}
        <section className="section">
          <SectionHead title="All stories" />
          {stories.length ? <StoryGrid stories={stories} /> : <div className="empty">{tr("No stories here yet. Please check back soon.")}</div>}
        </section>
      </div>
    </PageShell>
  );
}
