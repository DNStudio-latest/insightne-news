import { db } from "../lib/db.js";
import { SiteHeader, StoryList, YouTubeBox, SiteFooter } from "./components.js";

// Always show the newest approved stories (no waiting after you press APPROVE).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const stories = await db.listStories({ status: "approved", limit: 40 });
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <h1 className="page-title">Latest news</h1>
        <StoryList stories={stories} />
        <YouTubeBox />
      </main>
      <SiteFooter />
    </>
  );
}
