// Pieces shared by the public pages.
import { site } from "../lib/site-cache.js";
import { settings, generalRegion, states, regions, northeastRegions, widerRegions, topics, slugify, bylineName } from "../lib/config.js";
import { formatDate, formatDay, timeAgo, uniqueSources } from "../lib/format.js";
import { CopyLinkButton, NavBar } from "./client.js";
import { AI_CREDIT } from "../lib/images.js";
import { initLang, lang, pick, tr } from "../lib/lang.js";
import { LangSwitch, AlertsButton, NewsletterSignup, LanguageWelcome } from "./client.js";
import { newsletterReady } from "../lib/newsletter.js";
import { pushPublicKey } from "../lib/push.js";
import { indiaMatch } from "../lib/cricket.js";

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
  hi: {
    start: "खबरों की सूचना", on: "सूचना चालू", stop: "बंद करने के लिए दबाएँ",
    blocked: "इस साइट की सूचनाएँ बंद हैं। चालू करने के लिए वेब पते के पास ताले के चिह्न पर दबाएँ, फिर Permissions → Notifications → Allow।",
    iphone: "आईफ़ोन पर: Share बटन दबाएँ, फिर \"Add to Home Screen\"। होम स्क्रीन से InsightNE खोलकर वहाँ सूचना चालू करें।",
    failed: "सूचना चालू नहीं हो सकी। फिर से कोशिश करें।",
  },
  as: {
    start: "বাতৰিৰ জাননী", on: "জাননী চালু", stop: "বন্ধ কৰিবলৈ টিপক",
    blocked: "এই চাইটৰ জাননী বন্ধ কৰা আছে। চালু কৰিবলৈ ৱেব ঠিকনাৰ কাষৰ তলাৰ চিহ্নত টিপক, তাৰ পিছত Permissions → Notifications → Allow।",
    iphone: "আইফোনত: Share বুটামত টিপক, তাৰ পিছত \"Add to Home Screen\"। হোম স্ক্ৰীনৰ পৰা InsightNE খুলি তাত জাননী চালু কৰক।",
    failed: "জাননী চালু কৰিব পৰা নগ'ল। পুনৰ চেষ্টা কৰক।",
  },
  ne: {
    start: "समाचार सूचना", on: "सूचना सक्रिय", stop: "बन्द गर्न थिच्नुहोस्",
    blocked: "यस साइटका सूचनाहरू बन्द छन्। खोल्न वेब ठेगानाछेउको तालाको चिन्हमा थिच्नुहोस्, त्यसपछि Permissions → Notifications → Allow।",
    iphone: "आईफोनमा: Share बटन थिच्नुहोस्, त्यसपछि \"Add to Home Screen\"। होम स्क्रिनबाट InsightNE खोलेर त्यहाँ सूचना सक्रिय गर्नुहोस्।",
    failed: "सूचना सक्रिय गर्न सकिएन। फेरि प्रयास गर्नुहोस्।",
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

// Live government broadcast: a red strip on every page, and the player on the front page and /live.
const liveTitle = (live) => (lang() === "bn" && live.title_bn) || live.title;

export function LiveBar({ live }) {
  if (!live) return null;
  return (
    <a className="live-bar" href="/live">
      <span className="live-label">● {tr("LIVE")}</span>
      <span className="live-text">{liveTitle(live)}</span>
      <span className="live-watch">{tr("Watch")} →</span>
    </a>
  );
}

export function LivePlayer({ live, big = false }) {
  if (!live) return null;
  return (
    <section className={`live-box${big ? " big" : ""}`} aria-label="Live broadcast">
      <div className="live-head">
        <span className="live-pill">● {tr("LIVE")}</span>
        <h2>{liveTitle(live)}</h2>
      </div>
      <div className="video-embed">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${live.youtubeId}`}
          title={liveTitle(live)}
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <p className="live-note">
        {tr("Source")}: {live.source} ·{" "}
        <a href={`https://www.youtube.com/watch?v=${live.youtubeId}`} target="_blank" rel="noopener noreferrer">{tr("Watch on YouTube")} ↗</a>
      </p>
    </section>
  );
}

// India men's live cricket score.
const scoreText = (i) => `${i.runs ?? 0}${i.wickets === 10 || i.wickets == null ? "" : `/${i.wickets}`}${i.overs != null ? ` (${i.overs})` : ""}`;
const teamScore = (match, team) =>
  match.innings
    .filter((i) => i.team === team.name)
    .map(scoreText)
    .join(" & ");

// A thin strip at the top of every page, only while India is playing.
export function CricketBar({ match }) {
  if (!match?.live) return null;
  return (
    <a className="cricket-bar" href="/#cricket">
      <span className="cricket-label">🏏 LIVE</span>
      <span className="cricket-text">
        {match.teams.map((t) => `${t.short} ${teamScore(match, t) || "–"}`).join("  ·  ")}
      </span>
    </a>
  );
}

// The bigger score box on the front page (live, today's result, or the next India match).
export function CricketBox({ match }) {
  if (!match) return null;
  return (
    <section className="cricket" id="cricket" aria-label="India cricket score">
      <div className="cricket-head">
        <span className={`cricket-pill${match.live ? " live" : ""}`}>{match.live ? "● LIVE" : match.ended ? "RESULT" : "UPCOMING"}</span>
        <span>🏏 {match.type ? `${match.type} · ` : ""}{match.name}</span>
      </div>
      <div className="cricket-teams">
        {match.teams.map((t) => (
          <div key={t.name} className="cricket-team">
            {t.img && <img src={t.img} alt="" width={28} height={28} loading="lazy" />}
            <b>{t.name}</b>
            <span>{teamScore(match, t) || (match.live ? "Yet to bat" : "")}</span>
          </div>
        ))}
      </div>
      {match.status && <p className="cricket-status">{match.status}</p>}
      <p className="cricket-note">
        {match.venue && `${match.venue} · `}Score updates every 15 minutes · Data: CricketData.org
      </p>
    </section>
  );
}

export function BreakingBar({ story }) {
  if (!story || Date.now() - new Date(story.published_at).getTime() > BREAKING_HOURS * 3600000) return null;
  return (
    <a className="breaking" href={storyUrl(story)}>
      <span className="breaking-label">{tr("Breaking")}</span>
      <span className="breaking-text">{pick(story, "headline")}</span>
    </a>
  );
}

export function SiteHeader({ current, ticker = [], updatedAt, breaking, cricket, live }) {
  const [first, ...rest] = settings.siteName.split(" ");
  return (
    <header>
      <LiveBar live={live} />
      <BreakingBar story={breaking} />
      <CricketBar match={cricket} />
      <div className="topbar">
        <div className="container">
          <span>
            {formatDay()}
            {updatedAt && <span className="updated">{` · ${tr("Updated")} ${timeAgo(updatedAt)}`}</span>}
          </span>
          <span className="topbar-links">
            <LangSwitch current={lang()} label={tr("Language")} />
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
        items={[...[...widerRegions, ...topics].map((t) => [t, categoryUrl(t), tr(t)]), ["Originals", "/originals", tr("Originals")], ["Live", "/live", tr("Live TV")], ["Videos", "/videos", tr("Videos")], ["Search", "/search", tr("Search")]]}
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
          {w.icon} <b>{w.names?.[lang()] || w.city}</b> {w.temp}°
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

// The front page's "Articles" column: byline articles, each with the writer's name and title.
export function ArticlesList({ stories }) {
  if (!stories.length) return null;
  return (
    <aside className="latest articles">
      <h3>
        <a href={categoryUrl("Articles")}>{tr("Articles")}</a>
      </h3>
      <ol>
        {stories.map((s) => (
          <li key={s.id}>
            <div>
              <a className="h-link" href={storyUrl(s)}>{pick(s, "headline")}</a>
              <span className="article-by">
                {bylineName(s.author)}
                {s.author_title && `, ${s.author_title}`}
              </span>
            </div>
            <a href={storyUrl(s)} tabIndex={-1} aria-hidden="true">
              {s.image_url ? (
                <img className="article-thumb" src={s.image_url} alt="" loading="lazy" width={64} height={64} />
              ) : (
                <span className="article-thumb article-thumb-pen">✍</span>
              )}
            </a>
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

export function Videos({ videos, title = lang() === "en" ? `Watch ${settings.youtubeName}` : `${settings.youtubeName} ${tr("Watch")}` }) {
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

// "By Rina Das" (linked to the reporter's page when link is set), or the sources of a brief.
export function Byline({ story, link = false }) {
  if (story.kind === "original") {
    const name = bylineName(story.author);
    return <>{tr("By")} {link ? <a href={`/author/${slugify(name)}`}>{name}</a> : name}</>;
  }
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

// Buttons to our pages on other platforms (only the ones filled in settings.json).
function SocialLinks() {
  const s = settings.social || {};
  const links = [
    ["YouTube", settings.youtubeUrl],
    ["WhatsApp", settings.whatsappChannelUrl],
    ["Facebook", s.facebook],
    ["Instagram", s.instagram],
    ["X", s.x],
    ["Telegram", s.telegram],
    ["RSS", "/feed.xml"],
  ].filter(([, url]) => url);
  return (
    <div className="social">
      {links.map(([name, url]) => (
        <a key={name} href={url} target={url.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer">{name}</a>
      ))}
    </div>
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
          <ul className="footer-links">
            {[...regions, ...topics].map((c) => (
              <li key={c}><a href={categoryUrl(c)}>{tr(c === generalRegion ? `All ${generalRegion}` : c)}</a></li>
            ))}
            <li><a href="/originals">Originals</a></li>
            <li><a href="/videos">Videos</a></li>
            <li><a href="/live">Live TV</a></li>
          </ul>
        </div>
        <div>
          <h4>About us</h4>
          <ul className="footer-links">
            <li><a href="/about">About</a></li>
            <li><a href="/team">Ownership &amp; team</a></li>
            <li><a href="/contact">Contact</a></li>
            <li><a href="/advertise">Advertise with us</a></li>
            <li><a href="/tips">Send a news tip</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/editorial-policy">Editorial policy</a></li>
            <li><a href="/ethics">Ethics &amp; fact-checking</a></li>
            <li><a href="/corrections">Corrections</a></li>
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
      <div className="container footer-social">
        <SocialLinks />
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
  const [[breaking], cricket, live] = await Promise.all([site.listStories({ status: "approved", breaking: true, limit: 1 }).catch(() => []), indiaMatch(), site.live()]);
  return (
    <>
      <SiteHeader current={current} ticker={ticker} updatedAt={updatedAt} breaking={breaking} cricket={cricket} live={live} />
      <main className="container">{children}</main>
      <SiteFooter />
      <LanguageWelcome current={lang()} />
    </>
  );
}

export { formatDate };
