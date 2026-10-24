// Shows dates and times in Indian time, e.g. "24 Oct 2026, 2:30 pm".
const formatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDate(iso) {
  if (!iso) return "";
  return formatter.format(new Date(iso));
}

// Each source shown once, even if it has two links (for example a site's main feed and its Tripura feed).
export function uniqueSources(sources = []) {
  const seen = new Set();
  return sources.filter((s) => !seen.has(s.source_name) && seen.add(s.source_name));
}
