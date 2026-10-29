"use client";
// The APPROVE / EDIT / REJECT buttons under each story.
import { useState } from "react";
import { approve, reject, saveEdit, unpublish, restore, makeLead, toggleBreaking, notifyReaders, postFacebook, postInstagram } from "./actions.js";
import { shrinkPhoto } from "./photo.js";

export default function StoryActions({ story, view, regions, topics, facebook = false, instagram = false, admin = true }) {
  // In no-AI mode a story arrives without a summary; WRITE SUMMARY opens the writing box.
  const needsSummary = !story.summary?.trim();
  const [editing, setEditing] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(story.image_url || null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sends the smaller photo (made on the phone) instead of the original big file.
  async function submitEdit(formData) {
    setBusy(true);
    formData.delete("image");
    if (photo) formData.set("image", photo);
    if (removeImage) formData.set("removeImage", "1");
    try {
      await saveEdit(formData);
    } finally {
      setBusy(false);
    }
  }
  const id = <input type="hidden" name="id" value={story.id} />;
  // Your own reports open in the full editor; news briefs are edited right here.
  const editButton =
    story.kind === "original" ? (
      <a className="btn btn-edit" href={`/admin/write?id=${story.id}`} style={{ textDecoration: "none" }}>OPEN EDITOR</a>
    ) : (
      <button className="btn btn-edit" type="button" onClick={() => setEditing(!editing)} aria-expanded={editing}>
        {editing ? "CLOSE" : "EDIT"}
      </button>
    );

  const approveFormId = `approve-${story.id}`;

  return (
    <>
      {admin && view === "pending" && story.needs_check && !needsSummary && (
        <label className="confirm">
          <input type="checkbox" form={approveFormId} required /> I have checked this story before approving
        </label>
      )}
      <div className="actions">
        {/* Editors can only write and edit; publishing and everything else is for the admin. */}
        {!admin &&
          (needsSummary && story.kind === "original" ? (
            <a className="btn btn-approve" href={`/admin/write?id=${story.id}`} style={{ gridColumn: "span 2", textDecoration: "none" }}>
              CONTINUE WRITING
            </a>
          ) : needsSummary ? (
            <button className="btn btn-approve" type="button" style={{ gridColumn: "span 2" }} onClick={() => setEditing(!editing)} aria-expanded={editing}>
              {editing ? "CLOSE" : "WRITE SUMMARY"}
            </button>
          ) : (
            editButton
          ))}
        {admin && view === "pending" && (
          <>
            {needsSummary && story.kind === "original" ? (
              <a className="btn btn-approve" href={`/admin/write?id=${story.id}`} style={{ gridColumn: "span 2", textDecoration: "none" }}>
                CONTINUE WRITING
              </a>
            ) : needsSummary ? (
              <button className="btn btn-approve" type="button" style={{ gridColumn: "span 2" }} onClick={() => setEditing(!editing)} aria-expanded={editing}>
                {editing ? "CLOSE" : "WRITE SUMMARY"}
              </button>
            ) : (
              <>
                <form action={approve} id={approveFormId}>
                  {id}
                  <button className="btn btn-approve" type="submit">APPROVE</button>
                </form>
                {editButton}
              </>
            )}
            <form action={reject}>
              {id}
              <button className="btn btn-reject" type="submit">REJECT</button>
            </form>
          </>
        )}
        {admin && view === "published" && (
          <>
            <form action={unpublish}>
              {id}
              <button className="btn btn-reject" type="submit">UNPUBLISH</button>
            </form>
            {editButton}
            <form action={makeLead}>
              {id}
              {story.is_lead && <input type="hidden" name="remove" value="1" />}
              <button className="btn btn-edit" type="submit">{story.is_lead ? "UN-LEAD" : "MAKE LEAD"}</button>
            </form>
            <form action={toggleBreaking} style={{ gridColumn: "1 / -1" }}>
              {id}
              {story.is_breaking && <input type="hidden" name="remove" value="1" />}
              <button className={`btn ${story.is_breaking ? "btn-reject" : "btn-edit"}`} type="submit">
                {story.is_breaking ? "STOP BREAKING BANNER" : "🔴 BREAKING NEWS"}
              </button>
            </form>
            <form
              action={notifyReaders}
              style={{ gridColumn: "1 / -1" }}
              onSubmit={(e) => {
                if (!window.confirm("Send this headline as an alert to every reader who switched on alerts? Use this only for big news.")) e.preventDefault();
              }}
            >
              {id}
              {story.notified_at && <input type="hidden" name="again" value="1" />}
              <button className="btn btn-plain" type="submit">{story.notified_at ? "🔔 ALERT SENT · SEND AGAIN" : "🔔 SEND ALERT TO PHONES"}</button>
            </form>
            {facebook && !story.facebook_post_id && (
              <form
                action={postFacebook}
                style={{ gridColumn: "1 / -1" }}
                onSubmit={(e) => {
                  if (!window.confirm("Post this story on your Facebook page now?")) e.preventDefault();
                }}
              >
                {id}
                <button className="btn btn-plain" type="submit">📘 POST TO FACEBOOK</button>
              </form>
            )}
            {story.facebook_post_id && <p className="note" style={{ gridColumn: "1 / -1", margin: 0 }}>📘 Posted on Facebook</p>}
            {instagram && !story.instagram_post_id && (
              <form
                action={postInstagram}
                style={{ gridColumn: "1 / -1" }}
                onSubmit={(e) => {
                  if (!window.confirm("Post this story's news card on Instagram now?")) e.preventDefault();
                }}
              >
                {id}
                <button className="btn btn-plain" type="submit">📸 POST TO INSTAGRAM</button>
              </form>
            )}
            {story.instagram_post_id && <p className="note" style={{ gridColumn: "1 / -1", margin: 0 }}>📸 Posted on Instagram</p>}
            {/* Big picture cards for the WhatsApp channel: open, save the picture, post it with the caption. */}
            <div className="card-links">
              <span>🖼 WhatsApp card:</span>
              <a href={`/card/${story.slug}?type=live`} target="_blank" rel="noopener">🔴 LIVE</a>
              <a href={`/card/${story.slug}?type=breaking`} target="_blank" rel="noopener">BREAKING</a>
              <a href={`/card/${story.slug}?type=news`} target="_blank" rel="noopener">NEWS</a>
              <CopyCaption story={story} />
            </div>
          </>
        )}
        {admin && view === "rejected" && (
          <form action={restore}>
            {id}
            <button className="btn btn-edit" type="submit">TO PENDING</button>
          </form>
        )}
      </div>

      {editing && (
        <form action={submitEdit} className="edit-form">
          {id}
          <input type="hidden" name="view" value={view} />
          <label>
            Headline
            <input name="headline" defaultValue={story.headline} required maxLength={200} />
          </label>
          <label>
            Summary
            <textarea name="summary" defaultValue={story.summary} required maxLength={1200} placeholder="Write 2–3 sentences in your own words. Don't copy sentences from the source." />
          </label>
          <details className="bn-fields" open={Boolean(story.summary_bn)}>
            <summary>বাংলা (Bengali version)</summary>
            <label>
              Bengali headline
              <input name="headline_bn" lang="bn" defaultValue={story.headline_bn || ""} maxLength={300} />
            </label>
            <label>
              Bengali summary
              <textarea name="summary_bn" lang="bn" defaultValue={story.summary_bn || ""} maxLength={2000} placeholder="Leave empty and Gemini will write it at the next run." />
            </label>
          </details>
          <div className="edit-row">
            <label>
              State
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
          <label>
            Photo <span className="hint">(optional, only your own photo or one you have permission to use)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={async (e) => {
                const file = await shrinkPhoto(e.target.files?.[0]);
                setPhoto(file || null);
                setRemoveImage(false);
                setPreview(file ? URL.createObjectURL(file) : story.image_url || null);
              }}
            />
          </label>
          {preview && !removeImage && (
            <div>
              <img className="photo-preview" src={preview} alt="Photo preview" />
              <button type="button" className="btn btn-plain" style={{ marginTop: 8 }} onClick={() => { setRemoveImage(true); setPhoto(null); }}>
                Remove photo
              </button>
            </div>
          )}
          <div className="edit-row">
            <label>
              Photo caption
              <input name="image_caption" defaultValue={story.image_caption || ""} maxLength={300} placeholder="What the photo shows" />
            </label>
            <label>
              Photo credit
              <input name="image_credit" defaultValue={story.image_credit || ""} maxLength={120} placeholder="e.g. InsightNE" />
            </label>
          </div>
          {view === "pending" && story.needs_check && (
            <label className="confirm">
              <input type="checkbox" required /> I have checked this story before approving
            </label>
          )}
          <div className="edit-buttons">
            <button className="btn btn-edit" type="submit" formNoValidate disabled={busy}>{busy ? "SAVING…" : "SAVE"}</button>
            {admin && view === "pending" && (
              <button className="btn btn-approve" type="submit" name="andApprove" value="1" disabled={busy}>SAVE & APPROVE</button>
            )}
          </div>
        </form>
      )}
    </>
  );
}

// The words to post under the card picture: headline, short summary and the short link.
function CopyCaption({ story }) {
  const [copied, setCopied] = useState(false);
  const caption = `*${story.headline}*\n\n${story.summary || ""}\n\n👉 Read more: insightnenews.in/s/${story.slug.split("-").pop()}`;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(caption);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
        } catch {
          window.prompt("Copy this caption:", caption);
        }
      }}
    >
      {copied ? "✓ Caption copied" : "📋 Copy caption"}
    </button>
  );
}
