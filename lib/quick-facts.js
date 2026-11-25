// The "Quick facts" box at the top of an original story: only facts already stored with the story (place, date,
// who reported it, topic, sources). Nothing is written or guessed, so it is always in line with the story itself.
const MAX_SOURCES = 3;

// story: the stored story. Returns [{ label, value, translate }] in reading order; rows with no value are left out.
export function quickFacts(story, { sources = [], byline = "", when = "" } = {}) {
  const region = String(story?.region || "").trim();
  const names = sources.map((s) => String(s.source_name || "").trim()).filter(Boolean).slice(0, MAX_SOURCES);
  return [
    { label: "Where", value: region === "Northeast" ? "Northeast India" : region, translate: true },
    { label: "When", value: String(when || "").trim() },
    { label: "Reported by", value: String(byline || "").trim() },
    { label: "Topic", value: String(story?.topic || "").trim(), translate: true },
    { label: "Sources", value: names.join(", ") },
  ].filter((r) => r.value);
}
