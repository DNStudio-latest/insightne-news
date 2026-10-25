import { db, cleanSearch } from "../../lib/db.js";
import { PageShell, SectionHead, StoryGrid } from "../components.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Search", robots: { index: false, follow: true } };

export default async function SearchPage({ searchParams }) {
  const q = cleanSearch((await searchParams).q);
  const results = q ? await db.searchStories(q) : [];
  return (
    <PageShell current="Search">
      <form className="search-form" action="/search" role="search" style={{ marginBottom: 20 }}>
        <label className="sr-only" htmlFor="search-q">Search news</label>
        <input id="search-q" name="q" type="search" defaultValue={q} placeholder="Search news, e.g. Agartala" style={{ width: "100%", maxWidth: 420 }} autoFocus={!q} />
        <button type="submit">Search</button>
      </form>
      {q ? (
        <>
          <SectionHead title={`${results.length} result${results.length === 1 ? "" : "s"} for “${q}”`} />
          {results.length ? <StoryGrid stories={results} /> : <div className="empty">Nothing found. Try another word.</div>}
        </>
      ) : (
        <p className="note">Type a word, a place or a name.</p>
      )}
    </PageShell>
  );
}
