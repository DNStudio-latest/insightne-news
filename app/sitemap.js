// A list of all pages for Google (served at /sitemap.xml). Each page that also exists in Bengali is listed with its
// Bengali address (/bn/...) as well, and each entry names the other language's address, so Google can match them.
import { db } from "../lib/db.js";
import { settings, categories, slugify } from "../lib/config.js";
import { langPath } from "../lib/languages.js";
import { allHubs } from "../lib/hubs.js";

export const dynamic = "force-dynamic";

export default async function sitemap() {
  const base = settings.siteUrl;
  const url = (code, path) => `${base}${langPath(code, path) === "/" ? "" : langPath(code, path)}`;
  // Both language versions, each naming the other (hreflang). English only when there is no Bengali text.
  const both = (path, extra, bengali = true) => {
    if (!bengali) return [{ url: url("en", path), ...extra }];
    const languages = { en: url("en", path), bn: url("bn", path) };
    return [
      { url: url("en", path), ...extra, alternates: { languages } },
      { url: url("bn", path), ...extra, alternates: { languages } },
    ];
  };
  const fixed = ["/originals", "/videos", "/about", "/contact", "/privacy", "/terms", "/grievance", "/today", "/live", "/advertise", "/editorial-policy", "/corrections", "/ethics", "/team", "/tips"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "monthly",
  }));
  const home = both("/", { changeFrequency: "hourly" });
  const topics = allHubs().map((h) => ({ url: `${base}/topic/${h.slug}`, changeFrequency: "hourly" }));
  const sections = categories.flatMap((c) => both(`/category/${slugify(c)}`, { changeFrequency: "hourly" }));
  const stories = (await db.allPublishedSlugs(1000)).flatMap((s) => both(`/story/${s.slug}`, { lastModified: s.updated_at }, Boolean(s.summary_bn?.trim())));
  return [...home, ...topics, ...fixed, ...sections, ...stories];
}
