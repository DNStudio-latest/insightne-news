// A list of all pages for Google (served at /sitemap.xml).
import { db } from "../lib/db.js";
import { settings, categories, slugify } from "../lib/config.js";

export const dynamic = "force-dynamic";

export default async function sitemap() {
  const base = settings.siteUrl;
  const fixed = ["", "/originals", "/videos", "/about", "/contact", "/privacy", "/terms", "/grievance", "/today", "/live", "/advertise", "/editorial-policy", "/corrections", "/ethics", "/team", "/tips"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: p === "" ? "hourly" : "monthly",
  }));
  const sections = categories.map((c) => ({ url: `${base}/category/${slugify(c)}`, changeFrequency: "hourly" }));
  const stories = (await db.allPublishedSlugs(1000)).map((s) => ({ url: `${base}/story/${s.slug}`, lastModified: s.updated_at }));
  return [...fixed, ...sections, ...stories];
}
