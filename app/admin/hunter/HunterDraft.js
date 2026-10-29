"use client";
// One News Hunter draft: read it, edit it, approve (publish) or reject it.
import { useState } from "react";
import { saveHunterDraft, approveHunterDraft, rejectHunterDraft, restoreHunterDraft } from "../actions.js";

const FLAG_LABELS = {
  check: { text: "Has [CHECK] parts", color: "var(--danger)" },
  deleted: { text: "DELETED POST", color: "var(--danger)" },
  kokborok: { text: "Kokborok source", color: "#8a5a00" },
  ocr: { text: "Scanned document (OCR)", color: "#8a5a00" },
  video: { text: "From a video", color: "#555" },
};

const when = (iso) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

// Shows [CHECK …] notes in red so they are easy to find.
function Marked({ text }) {
  return String(text)
    .split(/(\[(?:CHECK|DELETED POST)[^\]]*\])/)
    .map((part, i) => (/^\[(CHECK|DELETED POST)/.test(part) ? <mark key={i} style={{ background: "#ffe1dc", color: "#a40000", fontWeight: 700 }}>{part}</mark> : part));
}

export default function HunterDraft({ draft, view, regions }) {
  const [editing, setEditing] = useState(false);
  const id = <input type="hidden" name="id" value={draft.id} />;
  const hasMarks = /\[(CHECK|DELETED POST)/.test(draft.headline + draft.body);

  return (
    <article className="story">
      <div className="meta">
        <span className="score">Score {draft.score ?? "?"}/10</span>
        {draft.flags.map((f) => FLAG_LABELS[f] && <span key={f} className="badge" style={{ background: FLAG_LABELS[f].color }}>{FLAG_LABELS[f].text}</span>)}
        <span className="tag">{draft.state}</span>
        {draft.topic && <span className="tag">{draft.topic}</span>}
        <span>News from {when(draft.event_at)} · found {when(draft.created_at)}</span>
      </div>

      {!editing ? (
        <>
          <h2><Marked text={draft.headline} /></h2>
          {draft.body.split(/\n\s*\n/).map((p, i) => (
            <p key={i} className="summary" style={{ whiteSpace: "pre-wrap" }}><Marked text={p} /></p>
          ))}
        </>
      ) : (
        <form action={saveHunterDraft} className="edit-form">
          {id}
          <label>
            Headline
            <input name="headline" defaultValue={draft.headline} required maxLength={300} />
          </label>
          <label>
            Story (leave an empty line between paragraphs; the first paragraph becomes the intro)
            <textarea name="body" defaultValue={draft.body} required rows={16} />
          </label>
          <label>
            State
            <select name="state" defaultValue={draft.state}>
              {regions.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <div className="edit-buttons">
            <button className="btn btn-edit" type="submit">SAVE</button>
            <button className="btn btn-approve" type="submit" name="andApprove" value="1">SAVE & APPROVE</button>
          </div>
        </form>
      )}

      {draft.problems?.length > 0 && (
        <div className="flag">
          <strong>What the safety check found</strong>
          <ul>
            {draft.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="src-list">
        {draft.sources.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">
              {s.kind === "pdf" ? "📄" : s.kind === "video" ? "▶" : "🌐"} {s.name} ↗
            </a>
            {s.title && <span className="orig">{s.title}</span>}
          </li>
        ))}
      </ul>

      <div className="actions">
        {view === "pending" && (
          <>
            <form
              action={approveHunterDraft}
              onSubmit={(e) => {
                if (hasMarks) {
                  e.preventDefault();
                  window.alert("Please check and remove the [CHECK] notes first: press EDIT.");
                } else if (!window.confirm("Publish this story on the website now?")) e.preventDefault();
              }}
            >
              {id}
              <button className="btn btn-approve" type="submit">APPROVE</button>
            </form>
            <button className="btn btn-edit" type="button" onClick={() => setEditing(!editing)} aria-expanded={editing}>
              {editing ? "CLOSE" : "EDIT"}
            </button>
            <form action={rejectHunterDraft}>
              {id}
              <button className="btn btn-reject" type="submit">REJECT</button>
            </form>
          </>
        )}
        {view === "rejected" && (
          <form action={restoreHunterDraft}>
            {id}
            <button className="btn btn-edit" type="submit">BACK TO WAITING</button>
          </form>
        )}
        {view === "approved" && draft.story_id && <p className="note" style={{ margin: 0 }}>✓ Published</p>}
      </div>
    </article>
  );
}
