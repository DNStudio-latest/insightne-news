import { notFound } from "next/navigation";
import { db } from "../../../lib/db.js";
import { settings, categoryFromSlug, slugify } from "../../../lib/config.js";
import { PageShell, SectionHead, StoryGrid } from "../../components.js";

export const dynamic = "force-dynamic";
const PER_PAGE = 18;

export async function generateMetadata({ params }) {
  const category = categoryFromSlug((await params).slug);
  if (!category) return { title: "Not found" };
  return {
    title: `${category} news`,
    description: `Latest ${category} news from ${settings.siteName}.`,
    alternates: { canonical: `/category/${slugify(category)}` },
  };
}

export default async function CategoryPage({ params, searchParams }) {
  const category = categoryFromSlug((await params).slug);
  if (!category) notFound();
  const page = Math.max(1, Number((await searchParams).page) || 1);

  const isRegion = settings.regions.includes(category);
  const filter = isRegion ? { region: category } : { topic: category };
  const stories = await db.listStories({ status: "approved", ...filter, limit: PER_PAGE + 1, offset: (page - 1) * PER_PAGE });

  return (
    <PageShell current={category}>
      <SectionHead title={`${category} news`} />
      <StoryGrid stories={stories.slice(0, PER_PAGE)} />
      {stories.length > PER_PAGE && (
        <div className="pager">
          <a href={`/category/${slugify(category)}?page=${page + 1}`}>Load more stories →</a>
        </div>
      )}
    </PageShell>
  );
}
