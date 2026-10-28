"use client";
// The "Write a story" form. Photos are made smaller on your phone before they are uploaded.
import { useState } from "react";
import { saveOriginal } from "../actions.js";
import { shrinkPhoto } from "../photo.js";

export default function StoryEditor({ story, regions, topics, defaultAuthor, role = "admin" }) {
  const admin = role === "admin";
  const [preview, setPreview] = useState(story?.image_url || null);
  const [photo, setPhoto] = useState(null);
  const [galleryFiles, setGalleryFiles] = useState([]);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const isPublished = story?.status === "approved";

  async function submit(formData) {
    setBusy(true);
    formData.delete("image");
    if (photo) formData.set("image", photo);
    if (removeImage) formData.set("removeImage", "1");
    formData.delete("galleryFiles");
    for (const f of galleryFiles) formData.append("galleryFiles", f);
    try {
      await saveOriginal(formData);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="editor">
      {story && <input type="hidden" name="id" value={story.id} />}

      <label>
        Headline
        <input type="text" name="headline" defaultValue={story?.headline} required maxLength={200} placeholder="Clear and factual, about 8–14 words" />
      </label>

      <label>
        Intro <span className="hint">— 1–2 sentences shown under the headline and on the front page</span>
        <textarea name="summary" defaultValue={story?.summary} maxLength={600} rows={3} placeholder="The most important facts: who, what, where, when." />
      </label>

      <label>
        Story text
        <span className="hint">Leave an empty line between paragraphs. Start a line with “## ” for a subheading, or “&gt; ” for a quote.</span>
        <textarea className="body" name="body" defaultValue={story?.body || ""} placeholder="Write the full report here…" />
      </label>

      <details className="bn-fields" open={Boolean(story?.headline_bn)}>
        <summary>বাংলা (Bengali version, optional)</summary>
        <label>
          Bengali headline
          <input type="text" name="headline_bn" lang="bn" defaultValue={story?.headline_bn || ""} maxLength={300} />
        </label>
        <label>
          Bengali intro <span className="hint">— leave empty and Gemini will write it from the English intro</span>
          <textarea name="summary_bn" lang="bn" defaultValue={story?.summary_bn || ""} maxLength={2000} rows={3} />
        </label>
        <label>
          Bengali story text <span className="hint">— optional; without it, Bengali readers see the English text</span>
          <textarea className="body" name="body_bn" lang="bn" defaultValue={story?.body_bn || ""} />
        </label>
      </details>

      <label>
        Photo <span className="hint">— only your own photos, or ones you have permission to use</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const file = await shrinkPhoto(e.target.files?.[0]);
            setPhoto(file || null);
            setRemoveImage(false);
            setPreview(file ? URL.createObjectURL(file) : story?.image_url || null);
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
      <div className="row">
        <label>
          Photo caption
          <input type="text" name="image_caption" defaultValue={story?.image_caption || ""} maxLength={300} placeholder="What the photo shows" />
        </label>
        <label>
          Photo credit
          <input type="text" name="image_credit" defaultValue={story?.image_credit || ""} maxLength={120} placeholder="e.g. InsightNE" />
        </label>
      </div>

      <label>
        More photos (gallery) <span className="hint">— optional; choose several at once. Readers swipe through them.</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={async (e) => {
            const files = [...(e.target.files || [])].slice(0, 12);
            setGalleryFiles(await Promise.all(files.map(shrinkPhoto)));
          }}
        />
      </label>
      {galleryFiles.length > 0 && <p className="hint">{galleryFiles.length} new photo(s) will be added when you save.</p>}
      {story?.gallery?.length > 0 && (
        <div>
          <span className="hint">Photos already in the gallery: untick any you want to remove.</span>
          <div className="gallery-edit">
            {story.gallery.map((g) => (
              <label key={g.url}>
                <input type="checkbox" name="keepGallery" value={g.url} defaultChecked />
                <img src={g.url} alt="" />
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="row">
        <label>
          State
          <select name="region" defaultValue={story?.region || regions[0]}>
            {regions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Topic
          <select name="topic" defaultValue={story?.topic || ""}>
            <option value="">None</option>
            {topics.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Written by
        <input type="text" name="author" defaultValue={story?.author || defaultAuthor} maxLength={120} />
      </label>

      {admin && (
        <label className="check">
          <input type="checkbox" name="is_lead" defaultChecked={Boolean(story?.is_lead)} /> Make this the lead story on the front page
        </label>
      )}

      {story?.needs_check && (
        <label className="confirm">
          <input type="checkbox" name="checked" required={false} /> I have checked this story's facts
        </label>
      )}

      <div className="editor-actions">
        {(admin || !isPublished) && (
          <button className="btn btn-edit" type="submit" name="intent" value="draft" disabled={busy} formNoValidate>
            {isPublished ? "MOVE TO DRAFTS" : "SAVE DRAFT"}
          </button>
        )}
        <button
          className="btn btn-approve"
          type="submit"
          name="intent"
          value="publish"
          disabled={busy}
          onClick={(e) => {
            const form = e.currentTarget.form;
            const missing = ["summary", "body"].filter((n) => !form.elements[n].value.trim());
            if (missing.length) {
              e.preventDefault();
              alert("Please write the intro and the story text before publishing.");
            } else if (story?.needs_check && !form.elements.checked.checked) {
              e.preventDefault();
              alert("Please tick “I have checked this story's facts” first.");
            }
          }}
        >
          {busy ? "SAVING…" : isPublished ? "UPDATE" : admin ? "PUBLISH" : "SEND FOR APPROVAL"}
        </button>
      </div>
    </form>
  );
}
