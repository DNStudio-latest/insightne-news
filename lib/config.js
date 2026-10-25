// Reads your two settings files so the rest of the code can use them.
import settingsFile from "../settings.json" with { type: "json" };
import sourcesFile from "../sources.json" with { type: "json" };

export const settings = settingsFile;

// "Northeast" covers stories about several states or the region as a whole; each state has its own section too.
export const generalRegion = settingsFile.generalRegion;
export const states = settingsFile.states;
export const regions = [generalRegion, ...states];
export const topics = settingsFile.topics;
export const categories = [...regions, ...topics];

export const isRegion = (name) => regions.includes(name);

// Which stories belong on a section page. "Northeast" shows every story; a state shows only its own.
export function sectionFilter(name) {
  if (name === generalRegion) return {};
  return isRegion(name) ? { region: name } : { topic: name };
}

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
