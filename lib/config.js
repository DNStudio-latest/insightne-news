// Reads your two settings files so the rest of the code can use them.
import settingsFile from "../settings.json" with { type: "json" };
import sourcesFile from "../sources.json" with { type: "json" };

export const settings = settingsFile;

// The editor's name as shown on the website: the desk name while publisher.showEditorName is false.
const realEditor = settingsFile.publisher?.editor;
export const editorName = settingsFile.publisher?.showEditorName === false || !realEditor ? settingsFile.defaultAuthor : realEditor;
// A story's byline as shown on the website (the editor's own stories carry the desk name while their name is hidden).
export const bylineName = (author) => (!author || author === realEditor ? editorName : author);

// "Northeast" covers stories about several states or the region as a whole; each state has its own section too.
export const generalRegion = settingsFile.generalRegion;
export const states = settingsFile.states;
// "Northeast" plus its eight states.
export const northeastRegions = [generalRegion, ...states];
// National and world news, kept in their own sections ("India", "World").
export const widerRegions = settingsFile.widerRegions || [];
export const regions = [...northeastRegions, ...widerRegions];
export const topics = settingsFile.topics;
export const categories = [...regions, ...topics];

export const isRegion = (name) => regions.includes(name);

// Which stories belong on a section page. "Northeast" shows every Northeast story; a state, India or World shows only its own.
export function sectionFilter(name) {
  if (name === generalRegion) return { regionIn: northeastRegions };
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
