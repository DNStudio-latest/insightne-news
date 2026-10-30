"use client";
// One News Hunter draft: read it, edit it, approve (publish) or reject it.
import { useState } from "react";
import { saveHunterDraft, approveHunterDraft, rejectHunterDraft, restoreHunterDraft, setHunterPhoto } from "../actions.js";

const FLAG_LABELS = {
  check: { text: "Has [CHECK] parts", color: "var(--danger)" },
  deleted: { text: "DELETED POST", color: "var(--danger)" },
  kokborok: { text: "Kokborok source", color: "#8a5a00" },
  ocr: { text: "Scanned document (OCR)", color: "#8a5a00" },
  video: { text: "From a video", color: "#555" },
  sensitive: { text: "Sensitive: crime, court, communal or deaths", color: "var(--danger)" },
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

      {draft.sources.some((s) => s.proof) && (
        <form action={setHunterPhoto} className="photo-choice">
          {id}
          <strong>📸 Proof screenshots</strong>
          <div className="proof-row">
            {draft.sources.map(
              (s, i) =>
                s.proof && (
                  <a key={i} href={`/api/hunter-proof?draft=${draft.id}&i=${i}`} target="_blank" rel="noopener noreferrer">
                    <img src={`/api/hunter-proof?draft=${draft.id}&i=${i}`} alt={`Screenshot of ${s.name}`} width={140} />
                    <span className="orig">{s.name}</span>
                  </a>
                ),
            )}
          </div>
          <label>
            Screenshot to use
            <select name="photoIndex" defaultValue={draft.photo_index ?? 0}>
              {draft.sources.map(
                (s, i) =>
                  s.proof && (
                    <option key={i} value={i}>
                      {s.name}
                    </option>
                  ),
              )}
            </select>
          </label>
          <label>
            <input type="checkbox" name="usePhoto" value="1" defaultChecked={draft.use_photo} /> Use this screenshot as the photo when published
          </label>
          <p className="note">
            Before switching this on, open the screenshot and check: (1) no mobile numbers, emails or private details are visible; (2) the page belongs to the source named; (3) you are allowed to use it. Other publishers' pages may be copyrighted.
          </p>
          <button className="btn btn-edit" type="submit">SAVE PHOTO CHOICE</button>
        </form>
      )}

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
