import { redirect } from "next/navigation";
import { db, cleanSearch } from "../../lib/db.js";
import { settings, regions } from "../../lib/config.js";
import { currentUser } from "../../lib/auth.js";
import { formatDate } from "../../lib/format.js";
import { logout } from "./actions.js";
import StoryActions from "./StoryActions.js";
import { facebookReady } from "../../lib/facebook.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Approval page", robots: { index: false, follow: false } };

const VIEWS = { pending: "pending", published: "approved", rejected: "rejected" };
const MAX_SHOWN = 100;

// When the news happened: the newest report among its sources (or when we collected it).
function newsTime(story) {
  if (story.status === "approved" && story.published_at) return new Date(story.published_at).getTime();
  const reported = Math.max(0, ...story.sources.map((s) => (s.published_at ? new Date(s.published_at).getTime() : 0)));
  return reported || new Date(story.created_at).getTime();
}

const SORTS = {
  newest: (a, b) => newsTime(b) - newsTime(a),
  important: (a, b) => (b.score ?? 99) - (a.score ?? 99) || newsTime(b) - newsTime(a),
};

export default async function AdminPage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  const admin = user.role === "admin";
  const params = await searchParams;
  const view = VIEWS[params.view] && (admin || params.view !== "rejected") ? params.view : "pending";
  const q = cleanSearch(params.q);
  const state = regions.includes(params.state) ? params.state : "";
  const sort = SORTS[params.sort] ? params.sort : "newest";
  const filtering = Boolean(q || state);

  const [found, pendingAll, lastRun] = await Promise.all([
    q ? db.searchStories(q, { status: VIEWS[view], limit: 300 }) : db.listStories({ status: VIEWS[view], limit: 500 }),
    view === "pending" && !filtering ? null : db.listStories({ status: "pending", limit: 500 }),
    db.lastRun(),
  ]);
  const matching = found.filter((s) => !state || s.region === state).sort(SORTS[sort]);
  const stories = matching.slice(0, MAX_SHOWN);
  const pendingCount = (pendingAll ?? found).length;

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>{settings.siteName} · {admin ? "Approvals" : "Editor"}</h1>
        <form action={logout}>
          <button className="btn btn-plain" type="submit">Sign out</button>
        </form>
      </div>

      <nav className="tabs">
        <a href="/admin?view=pending" aria-current={view === "pending" ? "page" : undefined}>Pending ({pendingCount})</a>
        <a href="/admin?view=published" aria-current={view === "published" ? "page" : undefined}>Published</a>
        {admin && <a href="/admin?view=rejected" aria-current={view === "rejected" ? "page" : undefined}>Rejected</a>}
        <a href="/admin/write">✍ Write story</a>
        {admin && (
          <>
            <a href="/admin/live">🔴 Live</a>
            <a href="/admin/whatsapp">📲 WhatsApp posts</a>
            <a href="/admin/polls">📊 Polls</a>
            <a href="/admin/newsletter">✉ Daily email</a>
            <a href="/admin/editors">👥 Editors</a>
          </>
        )}
        <a href="/" target="_blank">View website ↗</a>
      </nav>

      {params.done && <div className="notice">✓ {params.done}</div>}
      {!admin && (
        <p className="note">
          Signed in as <b>{user.name}</b> (editor): you can write stories, upload photos and edit. Your name appears as the byline on stories you write.{" "}
          {settings.editors?.canPublish === true ? "Stories you publish go live straight away." : "New stories you send go to Pending, and the admin publishes them."}
        </p>
      )}
      <RunBox run={lastRun} />

      <form className="admin-filter" action="/admin" role="search">
        <input type="hidden" name="view" value={view} />
        <label className="sr-only" htmlFor="admin-q">Search stories</label>
        <input id="admin-q" name="q" type="search" defaultValue={q} placeholder="🔍 Search: a name, place or word" />
        <div className="filter-row">
          <select name="state" defaultValue={state} aria-label="State">
            <option value="">All states</option>
            {regions.map((r) => (
              <option key={r} value={r}>{r === regions[0] ? `${r} (several states)` : r}</option>
            ))}
          </select>
          <select name="sort" defaultValue={sort} aria-label="Order">
            <option value="newest">Newest first</option>
            <option value="important">Most important first</option>
          </select>
          <button className="btn btn-approve" type="submit">SEARCH</button>
        </div>
        {(filtering || sort !== "newest") && (
          <p className="filter-result">
            {matching.length} {matching.length === 1 ? "story" : "stories"}
            {q && <> matching “{q}”</>}
            {state && <> in {state}</>} · <a href={`/admin?view=${view}`}>Clear</a>
          </p>
        )}
      </form>

      <div className="stories">
        {matching.length > MAX_SHOWN && (
          <p className="note">Showing the first {MAX_SHOWN} of {matching.length}. Use search or a state to find others.</p>
        )}
        {stories.length === 0 && (
          <div className="empty">
            {filtering ? "No stories found. Try another word or state." : view === "pending" ? "Nothing waiting. New stories arrive every 3 hours." : "Nothing here yet."}
          </div>
        )}
        {stories.map((story) => (
          <AdminStory key={story.id} story={story} view={view} admin={admin} />
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
      {run.practice_mode && " (no-AI mode)"} · {run.feeds_ok} feeds worked · {run.articles_new} new articles · {run.stories_created} new stories{run.auto_published > 0 && ` (${run.auto_published} auto-published)`}
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

function AdminStory({ story, view, admin }) {
  return (
    <article className="story">
      <div className="meta">
        {story.kind === "original" ? <span className="badge">Original</span> : <span className="score">Score {story.score}/10</span>}
        {story.is_lead && <span className="badge" style={{ background: "var(--accent)" }}>Lead story</span>}
        {story.is_breaking && <span className="badge" style={{ background: "var(--danger)" }}>Breaking</span>}
        <span className="tag">{story.region}</span>
        {story.topic && <span className="tag">{story.topic}</span>}
        <span>{story.status === "approved" ? "Published" : "Reported"} {formatDate(new Date(newsTime(story)).toISOString())}</span>
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

      <StoryActions story={story} view={view} regions={regions} topics={settings.topics} facebook={facebookReady()} admin={admin} />
    </article>
  );
}
