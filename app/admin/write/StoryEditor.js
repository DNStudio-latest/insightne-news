"use client";
// The "Write a story" form. Photos are made smaller on your phone before they are uploaded.
import { useState } from "react";
import { saveOriginal } from "../actions.js";

const MAX_SIDE = 1600;

async function shrinkPhoto(file) {
  if (!file || !file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ? new File([blob], "photo.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file; // Some phones send formats the browser can't read; the server then checks the type.
  }
}

export default function StoryEditor({ story, regions, topics, defaultAuthor }) {
  const [preview, setPreview] = useState(story?.image_url || null);
  const [photo, setPhoto] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [busy, setBusy] = useState(false);
  const isPublished = story?.status === "approved";

  async function submit(formData) {
    setBusy(true);
    formData.delete("image");
    if (photo) formData.set("image", photo);
    if (removeImage) formData.set("removeImage", "1");
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

      <label className="check">
        <input type="checkbox" name="is_lead" defaultChecked={Boolean(story?.is_lead)} /> Make this the lead story on the front page
      </label>

      {story?.needs_check && (
        <label className="confirm">
          <input type="checkbox" name="checked" required={false} /> I have checked this story's facts
        </label>
      )}

      <div className="editor-actions">
        <button className="btn btn-edit" type="submit" name="intent" value="draft" disabled={busy} formNoValidate>
          {isPublished ? "MOVE TO DRAFTS" : "SAVE DRAFT"}
        </button>
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
          {busy ? "SAVING…" : isPublished ? "UPDATE" : "PUBLISH"}
        </button>
      </div>
    </form>
  );
}
