// The News Hunter's background check: before a draft is written, look for older records and other outlets'
// reports on the same event, so the draft can be confirmed, balanced and fact-checked. These are never the
// news itself: the news is the new official source. Background only confirms, adds dated context, or shows disagreement.
import { newsSearch, searchTopic, readReports } from "../research.js";
import { createPoliteFetcher } from "./polite.js";

const BACKGROUND_DAYS = 30; // older reports are kept only this far back
const MAX_REPORTS = 6;

// Returns { documents, notes, sources }. documents: [{ source, kind: "background", title, url, published, text }].
// Never throws: when search is not possible the draft simply says the background check was not done.
export async function backgroundCheck(event, { fetchFn = fetch, get = createPoliteFetcher({ gapMs: 2000, log: () => {} }), now = Date.now() } = {}) {
  const topic = `${event} (earlier reports and official records, last ${BACKGROUND_DAYS} days)`;
  const cutoff = now - BACKGROUND_DAYS * 86400000;
  const [news, google] = await Promise.allSettled([
    newsSearch(event, { fetchFn }).then((found) => readReports(found.filter((r) => !r.published || new Date(r.published).getTime() >= cutoff), get)),
    searchTopic(topic, { fetchFn, now }),
  ]);
  const reports = news.status === "fulfilled" ? news.value.slice(0, MAX_REPORTS) : [];
  const found = google.status === "fulfilled" ? google.value : null;

  const documents = reports.map((r) => ({ source: r.source, kind: "background", title: r.title, url: r.url, published: r.published, text: r.text }));
  if (found) documents.push({ source: "Google search results (gathered by Gemini)", kind: "background", title: topic, url: null, published: null, text: found.text });

  const notes = [];
  if (!documents.length) notes.push("Background check: no other reports or earlier records were found. Confirm the facts with the official source before publishing.");
  else notes.push(`Background check: ${reports.length} other news report(s) and ${found ? "a Google search" : "no Google search"} were used to confirm the facts.`);
  if (news.status === "rejected") notes.push(`Background check: news search not possible (${news.reason.message.slice(0, 120)}).`);
  if (google.status === "rejected") notes.push(`Background check: Google search not possible (${google.reason.message.slice(0, 120)}).`);

  const sources = [...reports.map((r) => ({ url: r.url, name: r.source, title: r.title })), ...(found?.sources || []).map((s) => ({ url: s.url, name: s.title, title: s.title }))]
    .filter((s, i, all) => all.findIndex((x) => x.url === s.url) === i);
  return { documents, notes, sources };
}
