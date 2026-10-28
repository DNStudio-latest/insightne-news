// "Top 5 today": the day's most important stories, ready to share as one WhatsApp message.
import { db } from "../../lib/db.js";
import { settings } from "../../lib/config.js";
import { formatDay } from "../../lib/format.js";
import { topStories } from "../../lib/top.js";
import { CopyTextButton } from "../client.js";
import { PageShell, SectionHead, Kicker, WhatsAppFollow, EmailSignup, storyUrl, absoluteUrl } from "../components.js";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Top 5 news today",
  description: `The five most important stories from Northeast India today, from ${settings.siteName}.`,
  alternates: { canonical: "/today" },
};

export default async function TodayPage() {
  const stories = await topStories(db);
  const message = [
    `*${settings.siteName} — Top ${stories.length} today*`,
    formatDay(),
    "",
    ...stories.map((s, i) => `${i + 1}. ${s.headline}\n${absoluteUrl(storyUrl(s))}`),
    "",
    settings.whatsappChannelUrl ? `Follow us on WhatsApp: ${settings.whatsappChannelUrl}` : `More news: ${settings.siteUrl}`,
  ].join("\n");

  return (
    <PageShell current="Top 5">
      <div className="page" style={{ maxWidth: 740 }}>
        <SectionHead title={`Top ${stories.length || 5} news today`} />
        <p className="note" style={{ marginTop: -4 }}>{formatDay()}</p>
        {stories.length ? (
          <ol className="top5">
            {stories.map((s) => (
              <li key={s.id}>
                <div>
                  <Kicker story={s} />
                  <h2>
                    <a className="h-link" href={storyUrl(s)}>{s.headline}</a>
                  </h2>
                  <p>{s.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="empty">No stories yet today. Please check back soon.</div>
        )}
        {stories.length > 0 && (
          <a className="wa-share" href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
            Share today's Top {stories.length} on WhatsApp
          </a>
        )}
        {stories.length > 0 && (
          <CopyTextButton className="wa-share wa-copy" text={message} label={`Copy Top ${stories.length} for the WhatsApp channel`} />
        )}
        <WhatsAppFollow />
        <EmailSignup />
      </div>
    </PageShell>
  );
}
