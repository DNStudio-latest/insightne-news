import { redirect } from "next/navigation";
import { db } from "../../../lib/db.js";
import { isLoggedIn } from "../../../lib/auth.js";
import { topStories } from "../../../lib/top.js";
import WhatsAppPosts from "./WhatsAppPosts.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "WhatsApp posts", robots: { index: false, follow: false } };

// Today's posts for the WhatsApp channel, made automatically: breaking stories of the last 24 hours first, then the Top 5.
export default async function WhatsAppPage() {
  if (!(await isLoggedIn())) redirect("/admin/login");
  const since = Date.now() - 24 * 3600 * 1000;
  const [breaking, top] = await Promise.all([db.listStories({ status: "approved", breaking: true, limit: 5 }), topStories(db, 5)]);
  const stories = [];
  for (const s of [...breaking.filter((b) => new Date(b.published_at).getTime() >= since), ...top]) {
    if (!stories.some((x) => x.id === s.id)) stories.push(s);
  }

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>📲 WhatsApp posts</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      <p className="note">
        Ready for your channel: today's top stories as picture cards with captions. Tap <b>Share</b>, choose your
        InsightNE News channel, then <b>Send</b>. This list updates by itself as you approve stories.
      </p>
      {stories.length === 0 ? (
        <div className="empty">No published stories in the last day yet.</div>
      ) : (
        <WhatsAppPosts
          stories={stories.map((s) => ({
            id: s.id,
            slug: s.slug,
            headline: s.headline,
            summary: s.summary || "",
            type: s.is_breaking ? "breaking" : "news",
          }))}
        />
      )}
    </div>
  );
}
