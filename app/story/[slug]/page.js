import { notFound } from "next/navigation";
import { db } from "../../../lib/db.js";
import { site } from "../../../lib/site-cache.js";
import { settings, slugify } from "../../../lib/config.js";
import { articleBlocks, formatDate, readingMinutes, uniqueSources } from "../../../lib/format.js";
import { AI_CREDIT } from "../../../lib/images.js";
import { ViewCounter } from "../../client.js";
import { initLang, lang, pick, tr, isTranslated } from "../../../lib/lang.js";
import { WhatsAppFollow, EmailSignup, PageShell, Kicker, Byline, ShareButtons, StoryGrid, SectionHead, storyUrl, absoluteUrl } from "../../components.js";

export const dynamic = "force-dynamic";

async function load(params) {
  const story = await db.getStoryBySlug((await params).slug);
  return story && story.status === "approved" ? story : null;
}

export async function generateMetadata({ params }) {
  const story = await load(params);
  if (!story) return { title: "Story not found" };
  return {
    title: story.headline,
    description: story.summary,
    alternates: { canonical: storyUrl(story) },
    openGraph: {
      type: "article",
      title: story.headline,
      description: story.summary,
      url: storyUrl(story),
      publishedTime: story.published_at,
      ...(story.image_url ? { images: [{ url: story.image_url }] } : {}),
    },
  };
}

export default async function StoryPage({ params }) {
  await initLang();
  const story = await load(params);
  if (!story) notFound();

  const related = (await site.listStories({ status: "approved", region: story.region, limit: 7 })).filter((s) => s.id !== story.id).slice(0, 3);
  const sources = uniqueSources(story.sources);
  const isOriginal = story.kind === "original";
  const blocks = articleBlocks(pick(story, "body"));

  // Tells Google this is a news article (helps search and Google News).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: story.headline,
    description: story.summary,
    datePublished: story.published_at,
    dateModified: story.updated_at,
    mainEntityOfPage: absoluteUrl(storyUrl(story)),
    ...(story.image_url ? { image: [story.image_url] } : {}),
    author: isOriginal ? { "@type": "Person", name: story.author || settings.defaultAuthor, url: `${settings.siteUrl}/author/${slugify(story.author || settings.defaultAuthor)}` } : { "@type": "Organization", name: settings.siteName },
    publisher: { "@type": "Organization", name: settings.siteName, url: settings.siteUrl, logo: { "@type": "ImageObject", url: `${settings.siteUrl}/icon`, width: 192, height: 192 } },
  };

  return (
    <PageShell current={story.topic || story.region}>
      <article className="article">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
        <Kicker story={story} />
        <h1>{pick(story, "headline")}</h1>
        <p className="standfirst">{pick(story, "summary")}</p>
        {isTranslated(story) && <p className="translated-note">🌐 {tr("Translated automatically from English")}</p>}

        <div className="article-meta">
          <div className="byline">
            <Byline story={story} link />
            <br />
            <time dateTime={story.published_at}>{formatDate(story.published_at)}</time>
            {isOriginal && blocks.length > 0 && ` · ${readingMinutes(story.body)} min read`}
          </div>
          <ShareButtons story={story} />
        </div>

        {story.image_url && (
          <figure className="figure">
            <img src={story.image_url} alt={story.image_caption || story.headline} />
            {(story.image_caption || story.image_credit) && (
              <figcaption>
                {story.image_credit === AI_CREDIT ? (
                  <>🎨 AI-generated illustration — not a real photo of this event.</>
                ) : (
                  <>
                    {story.image_caption}
                    {story.image_credit && ` (Photo: ${story.image_credit})`}
                  </>
                )}
              </figcaption>
            )}
          </figure>
        )}

        {blocks.length > 0 && (
          <div className="article-body">
            {blocks.map((b, i) =>
              b.type === "h2" ? (
                <h2 key={i}>{b.text}</h2>
              ) : b.type === "quote" ? (
                <blockquote key={i}>{b.text}</blockquote>
              ) : b.type === "youtube" ? (
                <div key={i} className="video-embed">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${b.id}`}
                    title="Video"
                    loading="lazy"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <p key={i}>{b.text}</p>
              ),
            )}
          </div>
        )}

        {story.gallery?.length > 0 && (
          <section className="gallery" aria-label="Photo gallery">
            <h2>{tr("Photos")} ({story.gallery.length})</h2>
            <div className="gallery-strip">
              {story.gallery.map((g) => (
                <a key={g.url} href={g.url} target="_blank" rel="noopener noreferrer">
                  <img src={g.url} alt={g.caption || pick(story, "headline")} loading="lazy" />
                </a>
              ))}
            </div>
          </section>
        )}

        {sources.length > 0 && (
          <aside className="source-box">
            <h2>{tr(isOriginal ? "Also reported by" : "Original reports")}</h2>
            <ul>
              {sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.source_name}</a>
                </li>
              ))}
            </ul>
            {!isOriginal && (
              <a className="read-full" href={sources[0].url} target="_blank" rel="noopener noreferrer">
                {tr("Read the full story on")} {sources[0].source_name} →
              </a>
            )}
          </aside>
        )}

        {!isOriginal && (
          <p className="note">
            This is a short news brief written by {settings.siteName}. The full report belongs to its publisher; please read it on
            their website.
          </p>
        )}
        <WhatsAppFollow />
        <EmailSignup />
        <ViewCounter id={story.id} />
      </article>

      {related.length > 0 && (
        <section className="section" style={{ marginTop: 34 }}>
          <SectionHead title="More news" />
          <StoryGrid stories={related} />
        </section>
      )}
    </PageShell>
  );
}
