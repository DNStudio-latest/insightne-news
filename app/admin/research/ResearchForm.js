"use client";
// The Research desk form. The button shows that the AI is working, because it takes about half a minute.
import { useState } from "react";
import { researchTopic } from "../actions.js";

export default function ResearchForm() {
  const [busy, setBusy] = useState(false);

  return (
    <form
      action={async (formData) => {
        setBusy(true);
        try {
          await researchTopic(formData);
        } finally {
          setBusy(false);
        }
      }}
      className="editor"
    >
      <label>
        Topic
        <input type="text" name="topic" required maxLength={300} placeholder="e.g. Tripura municipal elections 2026: candidates and nominations" />
      </label>
      <label>
        Your own details <span className="hint">— optional: facts you know, quotes you recorded, names, numbers. The draft uses them too.</span>
        <textarea name="notes" rows={6} maxLength={8000} placeholder="e.g. At the press meet in Agartala today, the SEC said nominations so far: 120. Quote from the SDM: “…”" />
      </label>
      <div className="editor-actions">
        <button className="btn btn-approve" type="submit" disabled={busy}>
          {busy ? "SEARCHING AND WRITING… (about 30 seconds)" : "RESEARCH AND WRITE DRAFT"}
        </button>
      </div>
    </form>
  );
}
