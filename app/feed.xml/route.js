// RSS feed: the 50 newest published stories, for news apps and feed readers (served at /feed.xml).
import { db } from "../../lib/db.js";
import { settings, bylineName } from "../../lib/config.js";

export const dynamic = "force-dynamic";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function GET() {
  const stories = await db.listStories({ status: "approved", limit: 50 });
  const items = stories
    .map((s) => {
      const url = `${settings.siteUrl}/story/${s.slug}`;
      return `    <item>
      <title>${esc(s.headline)}</title>
      <link>${esc(url)}</link>
      <guid isPermaLink="true">${esc(url)}</guid>
      <pubDate>${new Date(s.published_at).toUTCString()}</pubDate>
      <category>${esc(s.region)}</category>
      ${s.kind === "original" && s.author ? `<dc:creator>${esc(bylineName(s.author))}</dc:creator>` : ""}
      <description>${esc(s.summary)}</description>
    </item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(settings.siteName)}</title>
    <link>${esc(settings.siteUrl)}</link>
    <atom:link href="${esc(settings.siteUrl)}/feed.xml" rel="self" type="application/rss+xml" />
    <description>${esc(settings.tagline)}</description>
    <language>en-in</language>
${items}
  </channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
