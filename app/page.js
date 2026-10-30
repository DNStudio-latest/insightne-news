import { site } from "../lib/site-cache.js";
import { settings, generalRegion, states, northeastRegions, widerRegions, topics, ARTICLES } from "../lib/config.js";
import { capitalsWeather } from "../lib/weather.js";
import { indiaMatch } from "../lib/cricket.js";
import { LivePlayer, CricketBox, WhatsAppFollow, WeatherStrip, PageShell, LeadStory, LatestList, ArticlesList, Card, CategoryBlock, StatesBoxes, SectionHead, StoryGrid, Videos, categoryUrl } from "./components.js";
import { LiveUpdates, PollBox } from "./client.js";
import { initLang, lang } from "../lib/lang.js";

// A story appears the moment you press APPROVE (the approval page empties the one-minute memory in lib/site-cache.js).
export const dynamic = "force-dynamic";

// The newest story from each different state first, so no single state fills the section.
function acrossTheRegion(stories, count) {
  const picked = [];
  const seen = new Set();
  for (const s of stories) if (!seen.has(s.region) && picked.length < count) (seen.add(s.region), picked.push(s));
  for (const s of stories) if (!picked.includes(s) && picked.length < count) picked.push(s);
  return picked;
}

// Tells Google the site's name, logo and social pages (shown in Google Search and Google News).
const siteInfo = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "NewsMediaOrganization", "@id": `${settings.siteUrl}/#org`, name: settings.siteName, url: settings.siteUrl, logo: { "@type": "ImageObject", url: `${settings.siteUrl}/icon`, width: 192, height: 192 }, sameAs: [settings.youtubeUrl, settings.whatsappChannelUrl, ...Object.entries(settings.social || {}).filter(([k]) => !k.startsWith("_")).map(([, v]) => v)].filter(Boolean), publishingPrinciples: `${settings.siteUrl}/about` },
    { "@type": "WebSite", name: settings.siteName, url: settings.siteUrl, publisher: { "@id": `${settings.siteUrl}/#org` }, potentialAction: { "@type": "SearchAction", target: `${settings.siteUrl}/search?q={q}`, "query-input": "required name=q" } },
  ],
};

const POLL_LABELS = {
  en: { title: "Readers' poll", votes: "votes", note: "Readers' opinions, not a scientific survey.", failed: "Your vote could not be saved. Please try again." },
  bn: { title: "পাঠকের মত", votes: "ভোট", note: "এটি পাঠকদের মতামত, বৈজ্ঞানিক সমীক্ষা নয়।", failed: "ভোট দেওয়া যায়নি। আবার চেষ্টা করুন।" },
  hi: { title: "पाठकों की राय", votes: "वोट", note: "यह पाठकों की राय है, वैज्ञानिक सर्वेक्षण नहीं।", failed: "आपका वोट सेव नहीं हो सका। फिर से कोशिश करें।" },
  as: { title: "পাঠকৰ মত", votes: "ভোট", note: "এয়া পাঠকৰ মতামত, বৈজ্ঞানিক সমীক্ষা নহয়।", failed: "আপোনাৰ ভোট সংৰক্ষণ কৰিব পৰা নগ'ল। পুনৰ চেষ্টা কৰক।" },
  ne: { title: "पाठकको राय", votes: "मत", note: "यो पाठकहरूको राय हो, वैज्ञानिक सर्वेक्षण होइन।", failed: "तपाईंको मत सुरक्षित हुन सकेन। फेरि प्रयास गर्नुहोस्।" },
};

// The current reader poll, in the reader's language, with its vote totals.
async function readerPoll() {
  try {
    await initLang();
    const open = await site.poll();
    if (!open) return null;
    const { poll } = open;
    const bn = lang() === "bn";
    return {
      poll: { id: poll.id, question: (bn && poll.question_bn) || poll.question, options: poll.options.map((o) => (bn && o.text_bn) || o.text) },
      initialCounts: open.counts,
      labels: bn
        ? POLL_LABELS.bn
        : POLL_LABELS[lang()] || POLL_LABELS.en,
    };
  } catch {
    return null; // If the poll tables are not set up yet, the page simply shows no poll.
  }
}

export default async function HomePage() {
  const [stories, articles, videos, mostRead, weather, poll, cricket, live] = await Promise.all([
    site.listStories({ status: "approved", limit: 100 }),
    site.listStories({ status: "approved", topic: ARTICLES, limit: 6 }),
    site.videos(4),
    site.mostRead(1, 5).catch(() => []),
    capitalsWeather(),
    readerPoll(),
    indiaMatch(),
    site.live(),
  ]);

  if (!stories.length) {
    return (
      <PageShell>
        <div className="empty">No stories here yet. Please check back soon.</div>
        <Videos videos={videos} />
      </PageShell>
    );
  }

  const lead = stories.find((s) => s.is_lead) || stories.find((s) => s.kind === "original" && s.image_url) || stories[0];
  const others = stories.filter((s) => s.id !== lead.id);
  const latest = others.filter((s) => s.topic !== ARTICLES).slice(0, 8); // articles have their own column
  const ownStories = others.filter((s) => s.kind === "original" && s.topic !== ARTICLES);
  // Two more of our own stories under the lead (like a newspaper's front page), then the next three in "Originals".
  const underLead = ownStories.filter((s) => s.image_url).slice(0, 2);
  const originals = ownStories.filter((s) => !underLead.includes(s)).slice(0, 3);
  const hasSide = articles.length > 0 || mostRead.length >= 3;
  const storiesByState = states.map((state) => [state, others.filter((s) => s.region === state).slice(0, 3)]);

  return (
    <PageShell ticker={stories.slice(0, 10)} updatedAt={stories[0].published_at}>
      <LiveUpdates since={stories[0].published_at} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteInfo).replace(/</g, "\\u003c") }} />
      <h1 className="sr-only">{settings.siteName}: {settings.tagline}</h1>

      <LivePlayer live={live} />
      <WeatherStrip weather={weather} />
      <CricketBox match={cricket} />

      <div className={hasSide ? "front-top with-side" : "front-top"}>
        <div className="lead-col">
          <LeadStory story={lead} />
          {underLead.length > 0 && (
            <div className="under-lead">
              {underLead.map((s) => (
                <Card key={s.id} story={s} showSummary={false} />
              ))}
            </div>
          )}
        </div>
        <LatestList stories={latest} />
        {hasSide && (
          <div className="front-side">
            <ArticlesList stories={articles} />
            {mostRead.length >= 3 && <LatestList stories={mostRead} title="Most read today" />}
          </div>
        )}
      </div>

      {originals.length > 0 && (
        <section className="section">
          <SectionHead title="InsightNE Originals" href="/originals" />
          <StoryGrid stories={originals} columns={3} />
        </section>
      )}

      <WhatsAppFollow />

      {poll && <PollBox {...poll} />}


      <CategoryBlock title={`Across the ${generalRegion}`} href={categoryUrl(generalRegion)} stories={acrossTheRegion(others.filter((s) => northeastRegions.includes(s.region)), 5)} />

      <StatesBoxes storiesByState={storiesByState} />

      {widerRegions.map((r) => (
        <CategoryBlock key={r} title={r} stories={others.filter((s) => s.region === r).slice(0, 5)} />
      ))}

      <Videos videos={videos} />

      {topics.filter((t) => t !== ARTICLES).map((t) => (
        <CategoryBlock key={t} title={t} stories={others.filter((s) => s.topic === t).slice(0, 5)} />
      ))}
    </PageShell>
  );
}
