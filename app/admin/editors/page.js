import { redirect } from "next/navigation";
import { db } from "../../../lib/db.js";
import { currentRole } from "../../../lib/auth.js";
import { formatDate } from "../../../lib/format.js";
import { addEditor, changeEditor } from "../actions.js";
import { SUB_EDITOR, storyCounts } from "../../../lib/staff.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editors", robots: { index: false, follow: false } };

// Reporters and editors who can sign in. Each has their own name (shown as "By …" on their stories) and password.
export default async function EditorsPage({ searchParams }) {
  const role = await currentRole();
  if (!role) redirect("/admin/login");
  if (role !== "admin") redirect("/admin"); // admin only
  const { done } = await searchParams;
  const editors = await db.listEditors().catch(() => null);
  const counts = storyCounts(await db.storyAuthors().catch(() => []), editors || []);

  return (
    <div className="wrap">
      <div className="admin-bar">
        <h1>👥 Editors &amp; reporters</h1>
        <a className="btn btn-plain" href="/admin">← Back</a>
      </div>
      {done && <div className="notice">{done}</div>}
      {editors === null && (
        <div className="flag">
          <strong>One more step:</strong> run the latest supabase/schema.sql in Supabase → SQL Editor, then reload this page.
        </div>
      )}

      <form action={addEditor} className="editor">
        <h2 style={{ margin: 0 }}>Add a person</h2>
        <p className="hint" style={{ margin: 0 }}>
          They sign in at /admin with their own password. Their name appears automatically as the byline (“By …”) on
          stories they write. They can write, upload photos and edit, but not approve collected news or use alerts, polls
          or Facebook.
        </p>
        <label>
          Role
          <select name="role" defaultValue={SUB_EDITOR}>
            <option value={SUB_EDITOR}>Sub-editor: writes and edits only their own stories (no lead or breaking news)</option>
            <option value="editor">Editor: can edit every story</option>
          </select>
        </label>
        <label>
          Full name (as it should appear on stories)
          <input type="text" name="name" required maxLength={80} placeholder="e.g. Rina Das" />
        </label>
        <label>
          Password for them <span className="hint">— at least 8 characters, different from yours</span>
          <input type="text" name="password" required minLength={8} maxLength={100} autoComplete="off" />
        </label>
        <div className="editor-actions">
          <button className="btn btn-approve" type="submit">ADD PERSON</button>
        </div>
      </form>

      <div className="stories">
        {editors?.length === 0 && <div className="empty">No editors yet.</div>}
        {editors?.map((e) => (
          <article key={e.id} className="story">
            <div className="meta">
              <span className="badge" style={{ background: "var(--accent)" }}>{e.role === SUB_EDITOR ? "Sub-editor" : "Editor"}</span>
              {e.active ? <span className="badge">Can sign in</span> : <span className="tag">Paused</span>}
              <span>Added {formatDate(e.created_at)}</span>
            </div>
            <h2>
              {e.name} <span className="score" title="Published stories with their byline">📰 {counts[e.id]} {counts[e.id] === 1 ? "story" : "stories"}</span>
            </h2>
            <div className="actions">
              <form action={changeEditor}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="what" value="toggle" />
                <button className="btn btn-plain" type="submit">{e.active ? "PAUSE" : "ALLOW AGAIN"}</button>
              </form>
              <form action={changeEditor}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="what" value="role" />
                <button className="btn btn-plain" type="submit">{e.role === SUB_EDITOR ? "MAKE EDITOR" : "MAKE SUB-EDITOR"}</button>
              </form>
              <form action={changeEditor}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="what" value="remove" />
                <button className="btn btn-reject" type="submit">REMOVE</button>
              </form>
            </div>
            <details className="bn-fields">
              <summary>Change name or password</summary>
              <form action={changeEditor} className="editor" style={{ marginBottom: 8 }}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="what" value="rename" />
                <label>
                  Name
                  <input type="text" name="name" defaultValue={e.name} required maxLength={80} />
                </label>
                <button className="btn btn-edit" type="submit">SAVE NAME</button>
              </form>
              <form action={changeEditor} className="editor" style={{ marginBottom: 0 }}>
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="what" value="password" />
                <label>
                  New password
                  <input type="text" name="password" required minLength={8} maxLength={100} autoComplete="off" />
                </label>
                <button className="btn btn-edit" type="submit">SAVE PASSWORD</button>
              </form>
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
