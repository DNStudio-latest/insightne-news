// Reads your two settings files so the rest of the code can use them.
import settingsFile from "../settings.json" with { type: "json" };
import sourcesFile from "../sources.json" with { type: "json" };

export const settings = settingsFile;

export const categories = [...settingsFile.regions, ...settingsFile.topics];

export function enabledSources() {
  return sourcesFile.sources.filter((s) => s.enabled && s.feed);
}

// Names of sources you have marked as trusted for automatic publishing.
export function trustedSourceNames() {
  return new Set(sourcesFile.sources.filter((s) => s.autoPublish).map((s) => s.name));
}

export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function categoryFromSlug(slug) {
  return categories.find((c) => slugify(c) === slug) || null;
}
