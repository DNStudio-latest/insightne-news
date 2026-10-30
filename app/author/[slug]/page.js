// A reporter's page: their name and every original story they wrote.
import { notFound } from "next/navigation";
import { db } from "../../../lib/db.js";
import { settings, slugify, editorName, bylineName } from "../../../lib/config.js";
import { PageShell, SectionHead, StoryGrid } from "../../components.js";
import { staffTitle } from "../../../lib/staff.js";

export const dynamic = "force-dynamic";

async function authorStories(slug) {
  const originals = await db.listStories({ status: "approved", kind: "original", limit: 500 });
  return originals.filter((s) => slugify(bylineName(s.author)) === slug);
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const [first] = await authorStories(slug);
  if (!first) return { title: "Reporter" };
  const name = bylineName(first.author);
  return { title: name, description: `Reports by ${name} for ${settings.siteName}.`, alternates: { canonical: `/author/${slug}` } };
}

export default async function AuthorPage({ params }) {
  const { slug } = await params;
  const stories = await authorStories(slug);
  const editors = await db.listEditors().catch(() => []);
  const known = [editorName, ...editors.map((e) => e.name)].find((n) => n && slugify(n) === slug);
  const name = stories[0] ? bylineName(stories[0].author) : known;
  if (!name) notFound();
  const person = editors.find((e) => slugify(e.name) === slug);
  const role = name === editorName ? `Editor, ${settings.siteName}` : `${staffTitle(person)}, ${settings.siteName}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name,
    jobTitle: role,
    worksFor: { "@type": "NewsMediaOrganization", name: settings.siteName, url: settings.siteUrl },
    url: `${settings.siteUrl}/author/${slug}`,
  };
  return (
    <PageShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
      <SectionHead title={name} />
      <p className="note" style={{ marginTop: -4, marginBottom: 18 }}>
        {role} · {stories.length} {stories.length === 1 ? "report" : "reports"}
      </p>
      {stories.length ? <StoryGrid stories={stories} /> : <div className="empty">No reports yet.</div>}
    </PageShell>
  );
}
