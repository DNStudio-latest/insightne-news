import { redirect } from "next/navigation";
import { db } from "../../lib/db.js";
import { settings } from "../../lib/config.js";
import { isLoggedIn } from "../../lib/auth.js";
import { formatDate } from "../../lib/format.js";
import { logout } from "./actions.js";
import StoryActions from "./StoryActions.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Approval page", robots: { index: false, follow: false } };

const VIEWS = { pending: "pending", published: "approved", rejected: "rejected" };

export default async function AdminPage({ searchParams }) {
  if (!(await isLoggedIn())) redirect("/admin/login");
  const params = await searchParams;
  const view = VIEWS[params.view] ? params.view : "pending";

  const [stories, pendingStories, lastRun] = await Promise.all([
    db.listStories({ status: VIEWS[view], limit: view === "pending" ? 100 : 40 }),
    view === "pending" ? null : db.listStories({ status: "pending", limit: 100 }),
    db.lastRun(),
  ]);
  const pendingCount = (pendingStories ?? stories).length;

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>{settings.siteName} · Approvals</h1>
        <form action={logout}>
          <button className="btn btn-plain" type="submit">Sign out</button>
        </form>
      </div>

      <nav className="tabs">
        <a href="/admin?view=pending" aria-current={view === "pending" ? "page" : undefined}>Pending ({pendingCount})</a>
        <a href="/admin?view=published" aria-current={view === "published" ? "page" : undefined}>Published</a>
        <a href="/admin?view=rejected" aria-current={view === "rejected" ? "page" : undefined}>Rejected</a>
        <a href="/admin/write">✍ Write story</a>
        <a href="/" target="_blank">View website ↗</a>
      </nav>

      {params.done && <div className="notice">✓ {params.done}</div>}
      <RunBox run={lastRun} />

      <div className="stories">
        {stories.length === 0 && <div className="empty">{view === "pending" ? "Nothing waiting. New stories arrive every 3 hours." : "Nothing here yet."}</div>}
        {stories.map((story) => (
          <AdminStory key={story.id} story={story} view={view} />
        ))}
      </div>
    </div>
  );
}

function RunBox({ run }) {
  if (!run) return <div className="run-box">The collector has not run yet.</div>;
  return (
    <div className="run-box">
      <strong>Last check:</strong> {formatDate(run.started_at)}
      {run.practice_mode && " (no-AI mode)"} · {run.feeds_ok} feeds worked · {run.articles_new} new articles · {run.stories_created} new stories
      {run.feeds_failed?.length > 0 && (
        <ul>
          {run.feeds_failed.map((f) => (
            <li key={f.feed}>Feed not working: {f.name}</li>
          ))}
        </ul>
      )}
      {run.error && <ul><li>Problem: {run.error}</li></ul>}
    </div>
  );
}

function AdminStory({ story, view }) {
  return (
    <article className="story">
      <div className="meta">
        {story.kind === "original" ? <span className="badge">Original</span> : <span className="score">Score {story.score}/10</span>}
        {story.is_lead && <span className="badge" style={{ background: "var(--accent)" }}>Lead story</span>}
        <span className="tag">{story.region}</span>
        {story.topic && <span className="tag">{story.topic}</span>}
        <span>Collected {formatDate(story.created_at)}</span>
        {story.auto_published && <span>· auto-published</span>}
      </div>

      {story.needs_check && (
        <div className="flag">
          <strong>⚠ NEEDS EXTRA CHECK</strong>
          {story.check_reasons?.length > 0 && (
            <ul>
              {story.check_reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {story.image_url && <img src={story.image_url} alt="" style={{ maxHeight: 160, borderRadius: 8, marginTop: 8 }} />}
      <h2>{story.headline}</h2>
      {story.status === "approved" && story.slug && (
        <p className="byline"><a href={`/story/${story.slug}`} target="_blank">View on website ↗</a></p>
      )}
      {story.summary?.trim() ? (
        <p className="summary">{story.summary}</p>
      ) : (
        <p className="summary no-summary">✍ No summary yet. Read the source, then write 2–3 sentences in your own words.</p>
      )}

      <ul className="src-list">
        {story.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.source_name} ↗</a>
            {s.original_title && <span className="orig">Their headline: {s.original_title}</span>}
            {s.snippet && <span className="orig">Their intro: {s.snippet}</span>}
          </li>
        ))}
      </ul>

      <StoryActions story={story} view={view} regions={settings.regions} topics={settings.topics} />
    </article>
  );
}
