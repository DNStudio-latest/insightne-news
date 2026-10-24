"use client";
// The APPROVE / EDIT / REJECT buttons under each story.
import { useState } from "react";
import { approve, reject, saveEdit, unpublish, restore } from "./actions.js";

export default function StoryActions({ story, view, regions, topics }) {
  const [editing, setEditing] = useState(false);
  const id = <input type="hidden" name="id" value={story.id} />;
  const editButton = (
    <button className="btn btn-edit" type="button" onClick={() => setEditing(!editing)} aria-expanded={editing}>
      {editing ? "CLOSE" : "EDIT"}
    </button>
  );

  const approveFormId = `approve-${story.id}`;

  return (
    <>
      {view === "pending" && story.needs_check && (
        <label className="confirm">
          <input type="checkbox" form={approveFormId} required /> I have checked this story before approving
        </label>
      )}
      <div className="actions">
        {view === "pending" && (
          <>
            <form action={approve} id={approveFormId}>
              {id}
              <button className="btn btn-approve" type="submit">APPROVE</button>
            </form>
            {editButton}
            <form action={reject}>
              {id}
              <button className="btn btn-reject" type="submit">REJECT</button>
            </form>
          </>
        )}
        {view === "published" && (
          <>
            <form action={unpublish}>
              {id}
              <button className="btn btn-reject" type="submit">UNPUBLISH</button>
            </form>
            {editButton}
          </>
        )}
        {view === "rejected" && (
          <form action={restore}>
            {id}
            <button className="btn btn-edit" type="submit">TO PENDING</button>
          </form>
        )}
      </div>

      {editing && (
        <form action={saveEdit} className="edit-form">
          {id}
          <input type="hidden" name="view" value={view} />
          <label>
            Headline
            <input name="headline" defaultValue={story.headline} required maxLength={200} />
          </label>
          <label>
            Summary
            <textarea name="summary" defaultValue={story.summary} required maxLength={1200} />
          </label>
          <div className="edit-row">
            <label>
              Area
              <select name="region" defaultValue={story.region}>
                {regions.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <label>
              Topic
              <select name="topic" defaultValue={story.topic || ""}>
                <option value="">None</option>
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="edit-buttons">
            <button className="btn btn-edit" type="submit">SAVE</button>
            {view === "pending" && (
              <button className="btn btn-approve" type="submit" name="andApprove" value="1">SAVE & APPROVE</button>
            )}
          </div>
        </form>
      )}
    </>
  );
}
