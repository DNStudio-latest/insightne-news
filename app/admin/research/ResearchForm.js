"use client";
// The Research desk form. It is sent once only (a second tap does nothing), and while the AI works the button
// counts the seconds, because searching, reading and writing take about half a minute.
import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { researchTopic } from "../actions.js";

function SubmitButton() {
  const { pending } = useFormStatus();
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!pending) return setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [pending]);
  return (
    <button className="btn btn-approve" type="submit" disabled={pending}>
      {pending ? `SEARCHING, READING AND WRITING… ${seconds}s (please wait, about 40 seconds)` : "RESEARCH AND WRITE DRAFT"}
    </button>
  );
}

export default function ResearchForm() {
  return (
    <form
      action={researchTopic}
      className="editor"
      onSubmit={(e) => {
        // A form that is already being sent is not sent again.
        if (e.currentTarget.dataset.sending) e.preventDefault();
        else e.currentTarget.dataset.sending = "1";
      }}
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
        <SubmitButton />
      </div>
    </form>
  );
}
