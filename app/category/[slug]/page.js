import { notFound } from "next/navigation";
import { db } from "../../../lib/db.js";
import { settings, categoryFromSlug } from "../../../lib/config.js";
import { SiteHeader, StoryList, YouTubeBox, SiteFooter } from "../../components.js";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const category = categoryFromSlug((await params).slug);
  return { title: category ? `${category} news` : "Not found" };
}

export default async function CategoryPage({ params }) {
  const category = categoryFromSlug((await params).slug);
  if (!category) notFound();

  const isRegion = settings.regions.includes(category);
  const stories = await db.listStories({ status: "approved", limit: 40, ...(isRegion ? { region: category } : { topic: category }) });

  return (
    <>
      <SiteHeader current={category} />
      <main className="wrap">
        <h1 className="page-title">{category} news</h1>
        <StoryList stories={stories} />
        <YouTubeBox />
      </main>
      <SiteFooter />
    </>
  );
}
