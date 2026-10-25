import { db } from "../../lib/db.js";
import { settings } from "../../lib/config.js";
import { PageShell, SectionHead, StoryGrid } from "../components.js";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "InsightNE Originals",
  description: `Our own reports from across Northeast India, by the ${settings.siteName} team.`,
  alternates: { canonical: "/originals" },
};
const PER_PAGE = 18;

export default async function OriginalsPage({ searchParams }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const stories = await db.listStories({ status: "approved", kind: "original", limit: PER_PAGE + 1, offset: (page - 1) * PER_PAGE });
  return (
    <PageShell current="Originals">
      <SectionHead title="InsightNE Originals" />
      <p className="note" style={{ marginTop: -4, marginBottom: 18 }}>Our own reporting from the ground.</p>
      <StoryGrid stories={stories.slice(0, PER_PAGE)} />
      {stories.length > PER_PAGE && (
        <div className="pager">
          <a href={`/originals?page=${page + 1}`}>Load more stories →</a>
        </div>
      )}
    </PageShell>
  );
}
