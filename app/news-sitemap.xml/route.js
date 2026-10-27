// Google News sitemap: stories published in the last 2 days, in the format Google News reads.
import { db } from "../../lib/db.js";
import { settings } from "../../lib/config.js";

export const dynamic = "force-dynamic";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const since = Date.now() - 2 * 86400000;
  const stories = (await db.listStories({ status: "approved", limit: 300 })).filter((s) => new Date(s.published_at).getTime() >= since);
  const items = stories
    .map(
      (s) => `  <url>
    <loc>${esc(`${settings.siteUrl}/story/${s.slug}`)}</loc>
    <news:news>
      <news:publication><news:name>${esc(settings.siteName)}</news:name><news:language>en</news:language></news:publication>
      <news:publication_date>${new Date(s.published_at).toISOString()}</news:publication_date>
      <news:title>${esc(s.headline)}</news:title>
    </news:news>
  </url>`,
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${items}
</urlset>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
