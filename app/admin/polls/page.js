import { redirect } from "next/navigation";
import { db } from "../../../lib/db.js";
import { isLoggedIn } from "../../../lib/auth.js";
import { formatDate } from "../../../lib/format.js";
import { savePoll, togglePoll, deletePoll } from "../actions.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reader polls", robots: { index: false, follow: false } };

export default async function PollsPage({ searchParams }) {
  if (!(await isLoggedIn())) redirect("/admin/login");
  const { done, error } = await searchParams;
  const polls = await db.listPolls();
  const counts = await Promise.all(polls.map((p) => db.pollCounts(p.id, p.options.length)));

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>📊 Reader polls</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      {done && <div className="notice">✓ {done}</div>}
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      <form action={savePoll} className="editor">
        <h2 style={{ margin: 0 }}>New poll</h2>
        <p className="hint" style={{ margin: 0 }}>
          Ask one clear, fair question with 2–4 answers. It appears on the front page straight away and replaces the old poll.
        </p>
        <label>
          Question
          <input type="text" name="question" required maxLength={200} placeholder="e.g. Should Agartala get a second bridge over the Haora river?" />
        </label>
        {[0, 1, 2, 3].map((i) => (
          <label key={i}>
            Answer {i + 1} {i > 1 && <span className="hint">— optional</span>}
            <input type="text" name={`option${i}`} required={i < 2} maxLength={80} placeholder={["Yes", "No", "Not sure", ""][i]} />
          </label>
        ))}
        <details className="bn-fields">
          <summary>Bengali version (optional)</summary>
          <label>
            Bengali question
            <input type="text" name="question_bn" lang="bn" maxLength={300} />
          </label>
          {[0, 1, 2, 3].map((i) => (
            <label key={i}>
              Bengali answer {i + 1}
              <input type="text" name={`option${i}_bn`} lang="bn" maxLength={120} />
            </label>
          ))}
        </details>
        <div className="editor-actions">
          <button className="btn btn-approve" type="submit">PUT POLL ON WEBSITE</button>
        </div>
      </form>

      <div className="stories">
        {polls.length === 0 && <div className="empty">No polls yet.</div>}
        {polls.map((poll, n) => {
          const total = counts[n].reduce((a, b) => a + b, 0);
          return (
            <article key={poll.id} className="story">
              <div className="meta">
                {poll.is_open ? <span className="badge">On the website</span> : <span className="tag">Closed</span>}
                <span>{formatDate(poll.created_at)} · {total} vote{total === 1 ? "" : "s"}</span>
              </div>
              <h2>{poll.question}</h2>
              <ul className="poll-results">
                {poll.options.map((o, i) => (
                  <li key={i}>
                    <span>{o.text}</span> <b>{counts[n][i]} ({total ? Math.round((counts[n][i] / total) * 100) : 0}%)</b>
                  </li>
                ))}
              </ul>
              <div className="actions">
                <form action={togglePoll}>
                  <input type="hidden" name="id" value={poll.id} />
                  {poll.is_open && <input type="hidden" name="close" value="1" />}
                  <button className="btn btn-plain" type="submit">{poll.is_open ? "CLOSE POLL" : "SHOW AGAIN"}</button>
                </form>
                <form action={deletePoll}>
                  <input type="hidden" name="id" value={poll.id} />
                  <button className="btn btn-reject" type="submit">DELETE</button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
