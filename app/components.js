// Pieces shared by the public pages.
import { db } from "../lib/db.js";
import { settings, generalRegion, states, regions, northeastRegions, widerRegions, topics, slugify } from "../lib/config.js";
import { formatDate, formatDay, timeAgo, uniqueSources } from "../lib/format.js";
import { CopyLinkButton, NavBar } from "./client.js";
import { AI_CREDIT } from "../lib/images.js";
import { initLang, lang, pick, tr } from "../lib/lang.js";
import { LangSwitch, AlertsButton, NewsletterSignup } from "./client.js";
import { newsletterReady } from "../lib/newsletter.js";
import { pushPublicKey } from "../lib/push.js";

const ALERT_LABELS = {
  en: {
    start: "Get alerts", on: "Alerts on", stop: "Tap to stop alerts",
    blocked: "Alerts are blocked for this site. To allow them, tap the lock icon next to the web address, then Permissions → Notifications → Allow.",
    iphone: "On iPhone: tap the Share button, then \"Add to Home Screen\". Open InsightNE from your home screen and tap \"Get alerts\" there.",
    failed: "Could not switch on alerts. Please try again.",
  },
  bn: {
    start: "খবরের নোটিফিকেশন", on: "নোটিফিকেশন চালু", stop: "বন্ধ করতে চাপুন",
    blocked: "এই সাইটের নোটিফিকেশন বন্ধ করা আছে। চালু করতে ওয়েব ঠিকানার পাশে তালা চিহ্নে চাপুন, তারপর Permissions → Notifications → Allow।",
    iphone: "আইফোনে: Share বোতাম চাপুন, তারপর \"Add to Home Screen\"। হোম স্ক্রিন থেকে InsightNE খুলে সেখানে নোটিফিকেশন চালু করুন।",
    failed: "নোটিফিকেশন চালু করা যায়নি। আবার চেষ্টা করুন।",
  },
};

export const storyUrl = (story) => `/story/${story.slug}`;
export const categoryUrl = (name) => `/category/${slugify(name)}`;
export const absoluteUrl = (path) => new URL(path, settings.siteUrl).toString();

export function storyCategory(story) {
  return story.topic || story.region;
}

// Your own photo if the story has one; otherwise a category artwork (never another site's photo).
export function StoryImage({ story, eager = false }) {
  if (story.image_url) {
    const img = <img className="thumb" src={story.image_url} alt={story.image_caption || story.headline} loading={eager ? "eager" : "lazy"} />;
    if (story.image_credit !== AI_CREDIT) return img;
    // AI pictures are always labelled, so no reader mistakes them for a real photo.
    return (
      <div className="ai-wrap">
        {img}
        <span className="ai-label">{tr("AI illustration")}</span>
      </div>
    );
  }
  const cat = storyCategory(story);
  return (
    <div className={`art art-${slugify(cat)}`} aria-hidden="true">
      <span>{tr(cat)}</span>
    </div>
  );
}

export function Kicker({ story }) {
  const cat = storyCategory(story);
  return (
    <span className="kicker">
      {story.kind === "original" && <span className="badge">{tr("Original")}</span>}
      <a className="kicker" href={categoryUrl(cat)}>{tr(cat)}</a>
    </span>
  );
}

const BREAKING_HOURS = 12;

export function BreakingBar({ story }) {
  if (!story || Date.now() - new Date(story.published_at).getTime() > BREAKING_HOURS * 3600000) return null;
  return (
    <a className="breaking" href={storyUrl(story)}>
      <span className="breaking-label">{tr("Breaking")}</span>
      <span className="breaking-text">{pick(story, "headline")}</span>
    </a>
  );
}

export function SiteHeader({ current, ticker = [], updatedAt, breaking }) {
  const [first, ...rest] = settings.siteName.split(" ");
  return (
    <header>
      <BreakingBar story={breaking} />
      <div className="topbar">
        <div className="container">
          <span>
            {formatDay()}
            {updatedAt && <span className="updated">{` · ${tr("Updated")} ${timeAgo(updatedAt)}`}</span>}
          </span>
          <span className="topbar-links">
            <LangSwitch current={lang()} />
            <AlertsButton publicKey={pushPublicKey()} lang={lang()} labels={ALERT_LABELS[lang()] || ALERT_LABELS.en} />
            <a href="/today">📰 {tr("Top 5 today")}</a>
            {settings.whatsappChannelUrl && (
              <a href={settings.whatsappChannelUrl} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
            )}
            <a className="yt-link" href={settings.youtubeUrl} target="_blank" rel="noopener noreferrer">▶ YouTube</a>
          </span>
        </div>
      </div>
      <div className="masthead">
        <div className="container">
          <div>
            <a href="/" className="logo">
              {first}
              {rest.length > 0 && <span> {rest.join(" ")}</span>}
            </a>
            <p className="tagline">{tr(settings.tagline)}</p>
          </div>
          <form className="search-form" action="/search" role="search">
            <label className="sr-only" htmlFor="q">Search news</label>
            <input id="q" name="q" type="search" placeholder={tr("Search news")} />
            <button type="submit">Search</button>
          </form>
        </div>
      </div>
      <NavBar
        current={current}
        generalRegion={generalRegion}
        states={states}
        labels={{ home: tr("Home"), region: tr(generalRegion), all: tr(`All ${generalRegion}`) }}
        stateLinks={northeastRegions.map((r) => [r, categoryUrl(r), tr(r)])}
        items={[...[...widerRegions, ...topics].map((t) => [t, categoryUrl(t), tr(t)]), ["Originals", "/originals", tr("Originals")], ["Videos", "/videos", tr("Videos")], ["Search", "/search", tr("Search")]]}
      />
      {ticker.length > 0 && (
        <div className="ticker" aria-label="Latest headlines">
          <div className="container">
            <span className="ticker-label">{tr("LATEST")}</span>
            <div className="ticker-track">
              <div className="ticker-items">
                {ticker.map((s) => (
                  <a key={s.id} href={storyUrl(s)}>{pick(s, "headline")}</a>
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
          <a className="h-link" href={storyUrl(story)}>{pick(story, "headline")}</a>
        </h2>
        <p>{pick(story, "summary")}</p>
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
        <a className="h-link" href={storyUrl(story)}>{pick(story, "headline")}</a>
      </h3>
      {showSummary && <p>{pick(story, "summary")}</p>}
      <span className="byline">
        <time dateTime={story.published_at}>{timeAgo(story.published_at)}</time>
      </span>
    </article>
  );
}

export function WeatherStrip({ weather }) {
  if (!weather.length) return null;
  return (
    <div className="weather" aria-label="Weather in the state capitals">
      {weather.map((w) => (
        <span key={w.city} className="weather-item">
          {w.icon} <b>{lang() === "bn" ? w.cityBn : w.city}</b> {w.temp}°
        </span>
      ))}
    </div>
  );
}

export function LatestList({ stories, title = "Latest" }) {
  return (
    <aside className="latest">
      <h3>{tr(title)}</h3>
      <ol>
        {stories.map((s) => (
          <li key={s.id}>
            <time dateTime={s.published_at}>{timeAgo(s.published_at)}</time>
            <a className="h-link" href={storyUrl(s)}>{pick(s, "headline")}</a>
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function SectionHead({ title, href }) {
  return (
    <div className="section-head">
      <h2 className="section-title">{tr(title)}</h2>
      {href && <a className="more" href={href}>{tr("More →")}</a>}
    </div>
  );
}

// One big story with a list of headlines beside it.
export function CategoryBlock({ title, stories, href = categoryUrl(title) }) {
  if (!stories.length) return null;
  const [top, ...rest] = stories;
  return (
    <section className="section">
      <SectionHead title={title} href={href} />
      <div className="cat-block">
        <Card story={top} />
        <ul className="hl-list">
          {rest.map((s) => (
            <li key={s.id}>
              <a className="h-link" href={storyUrl(s)}>{pick(s, "headline")}</a>
              <div className="byline">{timeAgo(s.published_at)}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// A small box per state with its latest headlines (only states that have news).
export function StatesBoxes({ storiesByState }) {
  const filled = storiesByState.filter(([, list]) => list.length);
  if (!filled.length) return null;
  return (
    <section className="section">
      <SectionHead title="News from the states" href={categoryUrl(generalRegion)} />
      <div className="states-grid">
        {filled.map(([state, list]) => (
          <div key={state} className="state-box">
            <h3>
              <a href={categoryUrl(state)}>{state}</a>
              <a className="more" href={categoryUrl(state)}>{tr("More →")}</a>
            </h3>
            <ul className="hl-list">
              {list.map((s) => (
                <li key={s.id}>
                  <a className="h-link" href={storyUrl(s)}>{pick(s, "headline")}</a>
                  <div className="byline">{timeAgo(s.published_at)}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
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

export function Videos({ videos, title = lang() === "bn" ? `${settings.youtubeName} দেখুন` : `Watch ${settings.youtubeName}` }) {
  if (!videos.length) return null;
  return (
    <section className="videos" aria-label="Videos">
      <div className="section-head">
        <h2 className="section-title">{tr(title)}</h2>
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
  if (story.kind === "original") return <>{tr("By")} {story.author || settings.defaultAuthor}</>;
  const names = uniqueSources(story.sources).map((s) => s.source_name);
  return <>{names.length ? `${tr("Brief · Source:")} ${names.join(", ")}` : settings.defaultAuthor}</>;
}

// "Follow us on WhatsApp" box (shown only when the channel link is filled in settings.json).
export function WhatsAppFollow() {
  if (!settings.whatsappChannelUrl) return null;
  return (
    <aside className="wa-follow">
      <div>
        <strong>Get Northeast news on WhatsApp</strong>
        <span>Follow the {settings.siteName} channel for the day's top stories.</span>
      </div>
      <a href={settings.whatsappChannelUrl} target="_blank" rel="noopener noreferrer">Follow</a>
    </aside>
  );
}

export function ShareButtons({ story }) {
  const url = absoluteUrl(storyUrl(story));
  const text = encodeURIComponent(`${pick(story, "headline")} ${url}`);
  return (
    <div className="share" aria-label="Share this story">
      <a className="wa" href={`https://wa.me/?text=${text}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a className="fb" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">Facebook</a>
      <a className="x" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(story.headline)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">X</a>
      <CopyLinkButton url={url} />
    </div>
  );
}

// Daily-email sign-up box (shown only once the email service is set up).
export function EmailSignup() {
  if (!newsletterReady()) return null;
  return (
    <aside className="nl-box">
      <NewsletterSignup lang={lang()} />
    </aside>
  );
}

export function SiteFooter() {
  const [first, ...rest] = settings.siteName.split(" ");
  return (
    <footer className="site-footer">
      {newsletterReady() && (
        <div className="container footer-nl">
          <NewsletterSignup lang={lang()} />
        </div>
      )}
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
            {[...regions, ...topics].map((c) => (
              <li key={c}><a href={categoryUrl(c)}>{tr(c === generalRegion ? `All ${generalRegion}` : c)}</a></li>
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
            {settings.whatsappChannelUrl && (
              <li><a href={settings.whatsappChannelUrl} target="_blank" rel="noopener noreferrer">WhatsApp channel</a></li>
            )}
            <li><a href="/today">Top 5 today</a></li>
            {newsletterReady() && <li><a href="/newsletter">Daily email</a></li>}
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

export async function PageShell({ current, children, ticker, updatedAt }) {
  await initLang();
  const [breaking] = await db.listStories({ status: "approved", breaking: true, limit: 1 }).catch(() => []);
  return (
    <>
      <SiteHeader current={current} ticker={ticker} updatedAt={updatedAt} breaking={breaking} />
      <main className="container">{children}</main>
      <SiteFooter />
    </>
  );
}

export { formatDate };
