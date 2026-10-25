// Pieces shared by the public pages.
import { settings, categories, slugify } from "../lib/config.js";
import { formatDate, formatDay, timeAgo, uniqueSources } from "../lib/format.js";
import { CopyLinkButton } from "./client.js";

export const storyUrl = (story) => `/story/${story.slug}`;
export const categoryUrl = (name) => `/category/${slugify(name)}`;
export const absoluteUrl = (path) => new URL(path, settings.siteUrl).toString();

export function storyCategory(story) {
  return story.topic || story.region;
}

// Your own photo if the story has one; otherwise a category artwork (never another site's photo).
export function StoryImage({ story, eager = false }) {
  if (story.image_url) {
    return <img className="thumb" src={story.image_url} alt={story.image_caption || story.headline} loading={eager ? "eager" : "lazy"} />;
  }
  const cat = storyCategory(story);
  return (
    <div className={`art art-${slugify(cat)}`} aria-hidden="true">
      <span>{cat}</span>
    </div>
  );
}

export function Kicker({ story }) {
  const cat = storyCategory(story);
  return (
    <span className="kicker">
      {story.kind === "original" && <span className="badge">Original</span>}
      <a className="kicker" href={categoryUrl(cat)}>{cat}</a>
    </span>
  );
}

export function SiteHeader({ current, ticker = [], updatedAt }) {
  const [first, ...rest] = settings.siteName.split(" ");
  return (
    <header>
      <div className="topbar">
        <div className="container">
          <span>{formatDay()}{updatedAt ? ` · Updated ${timeAgo(updatedAt)}` : ""}</span>
          <a href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer">▶ YouTube</a>
        </div>
      </div>
      <div className="masthead">
        <div className="container">
          <div>
            <a href="/" className="logo">
              {first}
              {rest.length > 0 && <span> {rest.join(" ")}</span>}
            </a>
            <p className="tagline">{settings.tagline}</p>
          </div>
          <form className="search-form" action="/search" role="search">
            <label className="sr-only" htmlFor="q">Search news</label>
            <input id="q" name="q" type="search" placeholder="Search news" />
            <button type="submit">Search</button>
          </form>
        </div>
      </div>
      <nav className="navbar" aria-label="Sections">
        <div className="container nav">
          <a href="/" aria-current={!current ? "page" : undefined}>Home</a>
          {categories.map((c) => (
            <a key={c} href={categoryUrl(c)} aria-current={current === c ? "page" : undefined}>{c}</a>
          ))}
          <a href="/originals" aria-current={current === "Originals" ? "page" : undefined}>Originals</a>
          <a href="/videos" aria-current={current === "Videos" ? "page" : undefined}>Videos</a>
          <a href="/search" aria-current={current === "Search" ? "page" : undefined}>🔍 Search</a>
        </div>
      </nav>
      {ticker.length > 0 && (
        <div className="ticker" aria-label="Latest headlines">
          <div className="container">
            <span className="ticker-label">LATEST</span>
            <div className="ticker-track">
              <div className="ticker-items">
                {ticker.map((s) => (
                  <a key={s.id} href={storyUrl(s)}>{s.headline}</a>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function LeadStory({ story }) {
  return (
    <article className="lead">
      <a className="img-link" href={storyUrl(story)} tabIndex={-1} aria-hidden="true">
        <StoryImage story={story} eager />
      </a>
      <div>
        <Kicker story={story} />
        <h2>
          <a className="h-link" href={storyUrl(story)}>{story.headline}</a>
        </h2>
        <p>{story.summary}</p>
        <p className="byline" style={{ marginTop: 8 }}>
          <Byline story={story} /> · <time dateTime={story.published_at}>{timeAgo(story.published_at)}</time>
        </p>
      </div>
    </article>
  );
}

export function Card({ story, showSummary = true }) {
  return (
    <article className="card">
      <a className="img-link" href={storyUrl(story)} tabIndex={-1} aria-hidden="true">
        <StoryImage story={story} />
      </a>
      <Kicker story={story} />
      <h3>
        <a className="h-link" href={storyUrl(story)}>{story.headline}</a>
      </h3>
      {showSummary && <p>{story.summary}</p>}
      <span className="byline">
        <time dateTime={story.published_at}>{timeAgo(story.published_at)}</time>
      </span>
    </article>
  );
}

export function LatestList({ stories, title = "Latest" }) {
  return (
    <aside className="latest">
      <h3>{title}</h3>
      <ol>
        {stories.map((s) => (
          <li key={s.id}>
            <time dateTime={s.published_at}>{timeAgo(s.published_at)}</time>
            <a className="h-link" href={storyUrl(s)}>{s.headline}</a>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function SectionHead({ title, href }) {
  return (
    <div className="section-head">
      <h2 className="section-title">{title}</h2>
      {href && <a className="more" href={href}>More →</a>}
    </div>
  );
}

// One big story with a list of headlines beside it.
export function CategoryBlock({ title, stories }) {
  if (!stories.length) return null;
  const [top, ...rest] = stories;
  return (
    <section className="section">
      <SectionHead title={title} href={categoryUrl(title)} />
      <div className="cat-block">
        <Card story={top} />
        <ul className="hl-list">
          {rest.map((s) => (
            <li key={s.id}>
              <a className="h-link" href={storyUrl(s)}>{s.headline}</a>
              <div className="byline">{timeAgo(s.published_at)}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function StoryGrid({ stories, columns = 3 }) {
  if (!stories.length) return <div className="empty">No stories here yet. Please check back soon.</div>;
  return (
    <div className={`grid grid-${columns}`}>
      {stories.map((s) => (
        <Card key={s.id} story={s} />
      ))}
    </div>
  );
}

export function Videos({ videos, title = `Watch ${settings.youtubeName}` }) {
  if (!videos.length) return null;
  return (
    <section className="videos" aria-label="Videos">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        <a className="subscribe" href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer">▶ Subscribe</a>
      </div>
      <div className="grid grid-4">
        {videos.map((v) => (
          <a key={v.id} className="video" href={v.url} target="_blank" rel="noopener noreferrer">
            <div className="thumb-wrap">
              <img className="thumb" src={v.thumbnail} alt="" loading="lazy" />
            </div>
            <h3>{v.title}</h3>
          </a>
        ))}
      </div>
    </section>
  );
}

export function Byline({ story }) {
  if (story.kind === "original") return <>By {story.author || settings.defaultAuthor}</>;
  const names = uniqueSources(story.sources).map((s) => s.source_name);
  return <>{names.length ? `Brief · Source: ${names.join(", ")}` : settings.defaultAuthor}</>;
}

export function ShareButtons({ story }) {
  const url = absoluteUrl(storyUrl(story));
  const text = encodeURIComponent(`${story.headline} ${url}`);
  return (
    <div className="share" aria-label="Share this story">
      <a className="wa" href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a className="fb" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
      <a className="x" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(story.headline)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">X</a>
      <CopyLinkButton url={url} />
    </div>
  );
}

export function SiteFooter() {
  const [first, ...rest] = settings.siteName.split(" ");
  return (
    <footer className="site-footer">
      <div className="container">
        <div>
          <a href="/" className="logo">
            {first}
            {rest.length > 0 && <span> {rest.join(" ")}</span>}
          </a>
          <p>{settings.tagline}. Our own reports, and short news briefs in our own words that always link to the original publisher.</p>
        </div>
        <div>
          <h4>Sections</h4>
          <ul>
            {categories.map((c) => (
              <li key={c}><a href={categoryUrl(c)}>{c}</a></li>
            ))}
            <li><a href="/originals">Originals</a></li>
            <li><a href="/videos">Videos</a></li>
          </ul>
        </div>
        <div>
          <h4>About us</h4>
          <ul>
            <li><a href="/about">About</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/terms">Terms &amp; Disclaimer</a></li>
            <li><a href="/grievance">Grievance Redressal</a></li>
            <li><a href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer">YouTube</a></li>
          </ul>
        </div>
      </div>
      <div className="footnote">
        <div className="container">
          © {new Date().getFullYear()} {settings.siteName}. News briefs are short summaries written by us; full articles belong to
          their publishers and are linked. Photos on original reports are our own unless credited.
        </div>
      </div>
    </footer>
  );
}

export function PageShell({ current, children, ticker, updatedAt }) {
  return (
    <>
      <SiteHeader current={current} ticker={ticker} updatedAt={updatedAt} />
      <main className="container">{children}</main>
      <SiteFooter />
    </>
  );
}

export { formatDate };
