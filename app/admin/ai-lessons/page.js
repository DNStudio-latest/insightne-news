import { redirect } from "next/navigation";
import { currentUser } from "../../../lib/auth.js";
import { formatDate } from "../../../lib/format.js";
import { loadLessons } from "../../../lib/ai-lessons-store.js";
import { TOOLS, STATUS, LIMITS } from "../../../lib/ai-lessons.js";
import { suggestLesson, decide } from "./actions.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teach the AI", robots: { index: false, follow: false } };

function Action({ id, op, label, className = "btn btn-plain" }) {
  return (
    <form action={decide}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={op} />
      <button className={className} type="submit">{label}</button>
    </form>
  );
}

// Teach the AI: phrases the AI tools should stop using. Staff suggest lessons; the admin approves them.
export default async function AiLessonsPage({ searchParams }) {
  const user = await currentUser();
  if (!user) redirect("/admin/login");
  const admin = user.role === "admin";
  const { done, error } = await searchParams;
  const lessons = await loadLessons();
  const groups = ["waiting", "active", "off"].map((status) => [status, lessons.filter((l) => l.status === status)]);
  const inUse = lessons.filter((l) => l.status === "active").length;

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>🧠 Teach the AI</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      {done && <div className="notice">✓ {done}</div>}
      {error && <p className="error" style={{ marginBottom: 12 }}>{error}</p>}

      <p className="note">
        When an AI tool writes a phrase that sounds machine-written or breaks house style, add it here with a better
        wording. {admin ? "Your lessons are used at once." : "The admin checks each lesson before the AI uses it."}{" "}
        From then on the AI tools you tick are told to avoid the phrase, and their work is checked for it: the senior
        editor lists it in its notes, a summary that still uses it is written again and marked for checking, and a research
        draft lists it under problems. Lessons only change wording; they can never tell the AI to add a fact.
        {" "}{inUse} of at most {LIMITS.active} lessons are in use.
      </p>

      <form action={suggestLesson} className="editor">
        <h2 style={{ margin: 0 }}>New lesson</h2>
        <label>
          Phrase the AI should stop using
          <input type="text" name="phrase" required maxLength={LIMITS.phrase} placeholder='e.g. "in a significant development"' />
        </label>
        <label>
          Better wording <span className="hint">— optional; leave empty if the sentence should simply be rebuilt</span>
          <input type="text" name="better" maxLength={LIMITS.better} placeholder='e.g. leave it out and start with the news' />
        </label>
        <label>
          Why <span className="hint">— optional, one sentence; the AI reads this too</span>
          <input type="text" name="why" maxLength={LIMITS.why} placeholder="e.g. An empty opener; the lead should state the fact." />
        </label>
        <fieldset className="aic-tools">
          <legend>Which AI tools should learn it</legend>
          {Object.entries(TOOLS).map(([key, label]) => (
            <label key={key} className="check">
              <input type="checkbox" name="tools" value={key} defaultChecked /> {label}
            </label>
          ))}
        </fieldset>
        <div className="editor-actions">
          <button className="btn btn-approve" type="submit">{admin ? "SAVE AND USE NOW" : "SEND TO THE ADMIN"}</button>
        </div>
      </form>

      {groups.map(([status, list]) => (
        <section key={status}>
          <h2>{STATUS[status]} ({list.length})</h2>
          <div className="stories">
            {list.length === 0 && <div className="empty">None.</div>}
            {list.map((l) => (
              <article key={l.id} className="story">
                <div className="meta">
                  <span>Suggested by {l.by || "staff"} · {formatDate(l.created_at)}</span>
                  {l.decided_at && <span> · {status === "off" ? "switched off" : "approved"} by {l.decided_by} · {formatDate(l.decided_at)}</span>}
                </div>
                <p>
                  Avoid <del>{l.phrase}</del>
                  {l.better ? <> → <ins>{l.better}</ins></> : " → rebuild the sentence"}
                </p>
                {l.why && <p className="note">{l.why}</p>}
                <p className="note">For: {l.tools.map((t) => TOOLS[t]).join(", ")}</p>
                {admin && (
                  <div className="actions">
                    {status === "waiting" && <Action id={l.id} op="approve" label="APPROVE" className="btn btn-approve" />}
                    {status === "active" && <Action id={l.id} op="off" label="SWITCH OFF" />}
                    {status === "off" && <Action id={l.id} op="on" label="SWITCH ON" />}
                    <Action id={l.id} op="delete" label={status === "waiting" ? "REJECT" : "DELETE"} className="btn btn-reject" />
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
