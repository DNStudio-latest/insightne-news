// Pieces shared by the public pages: header, story card, YouTube box, footer.
import { settings, categories, slugify } from "../lib/config.js";
import { formatDate, uniqueSources } from "../lib/format.js";

export function SiteHeader({ current }) {
  const [first, ...rest] = settings.siteName.split(" ");
  return (
    <header className="site-header">
      <div className="wrap">
        <a href="/" className="logo">
          {first}
          {rest.length > 0 && <span> {rest.join(" ")}</span>}
        </a>
        <p className="tagline">{settings.tagline}</p>
      </div>
      <nav className="nav" aria-label="Categories">
        <a href="/" aria-current={!current ? "page" : undefined}>Latest</a>
        {categories.map((c) => (
          <a key={c} href={`/category/${slugify(c)}`} aria-current={current === c ? "page" : undefined}>
            {c}
          </a>
        ))}
      </nav>
    </header>
  );
}

export function StoryCard({ story }) {
  const sources = uniqueSources(story.sources);
  const main = story.sources[0];
  return (
    <article className="story">
      <div className="meta">
        <a className="tag" href={`/category/${slugify(story.region)}`}>{story.region}</a>
        {story.topic && <a className="tag" href={`/category/${slugify(story.topic)}`}>{story.topic}</a>}
        <time dateTime={story.published_at}>{formatDate(story.published_at)}</time>
      </div>
      <h2>{story.headline}</h2>
      <p className="summary">{story.summary}</p>
      <p className="sources">
        Source{sources.length > 1 ? "s" : ""}:{" "}
        {sources.map((s, i) => (
          <span key={s.url}>
            {i > 0 && ", "}
            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.source_name}</a>
          </span>
        ))}
      </p>
      {main && (
        <a className="read-more" href={main.url} target="_blank" rel="noopener noreferrer">
          Read full story on {main.source_name} →
        </a>
      )}
    </article>
  );
}

export function StoryList({ stories }) {
  if (!stories.length) return <div className="empty">No stories here yet. Please check back soon.</div>;
  return (
    <div className="stories">
      {stories.map((s) => (
        <StoryCard key={s.id} story={s} />
      ))}
    </div>
  );
}

export function YouTubeBox() {
  return (
    <section className="yt" aria-label="YouTube channel">
      <div>
        <h3>Watch {settings.youtubeName} on YouTube</h3>
        <p>Video reports and stories from Tripura and the Northeast.</p>
      </div>
      <a href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer">▶ Subscribe</a>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>
          {settings.siteName} writes short summaries in its own words and always links to the original reports. All
          full articles belong to their publishers. Please read the full story on their websites.
        </p>
        <p>© {new Date().getFullYear()} {settings.siteName}</p>
      </div>
    </footer>
  );
}
