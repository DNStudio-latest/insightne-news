"use client";
// The admin AI checker. It uses the same engine and trained model as the public /ai-tools/ page.
// The model (about 500 KB) loads only when this page opens.
import { useEffect, useState } from "react";
import { scoreText, styleEdit, applyAlternative, tokenize } from "../../../public/ai-tools/engine.js";
import { HANDOFF_KEY } from "./handoff.js";
import { editAsSeniorEditor } from "./actions.js";

const HANDOFF_MAX_AGE = 10 * 60 * 1000;

function takeHandoff() {
  try {
    const raw = localStorage.getItem(HANDOFF_KEY);
    localStorage.removeItem(HANDOFF_KEY);
    const { text, at } = JSON.parse(raw || "null") || {};
    return typeof text === "string" && Date.now() - at < HANDOFF_MAX_AGE ? text : "";
  } catch {
    return "";
  }
}

// The edited text with AI-like sentences highlighted.
function Marked({ text, suggestions }) {
  const spans = suggestions.filter((s) => s.kind === "sentence").sort((a, b) => a.index - b.index);
  const parts = [];
  let at = 0;
  for (const s of spans) {
    if (s.index < at) continue;
    parts.push(text.slice(at, s.index));
    parts.push(
      <mark key={s.index} title={s.cues?.length ? `Model cues: ${s.cues.join(", ")}` : "Reads as AI-written"}>
        {text.slice(s.index, s.index + s.length)}
      </mark>
    );
    at = s.index + s.length;
  }
  parts.push(text.slice(at));
  return <div className="aic-marked">{parts}</div>;
}

export default function AiCheck() {
  const [model, setModel] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [edit, setEdit] = useState(null); // { text, changes, suggestions }
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [proBusy, setProBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Counts the seconds while the senior editor works (it takes 10–40 seconds).
  useEffect(() => {
    if (!proBusy) return setSeconds(0);
    const timer = setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(timer);
  }, [proBusy]);

  useEffect(() => {
    const handed = takeHandoff();
    if (handed) setInput(handed);
    import("../../../public/ai-tools/model.js")
      .then((m) => setModel(m.TRAINED_MODEL))
      .catch(() => setLoadError("The checker could not load. Check your connection and reload the page."));
  }, []);

  const words = tokenize(input).length;

  function check(text = input, source = "original") {
    setError("");
    try {
      setResult({ ...scoreText(text, model), source });
    } catch (e) {
      setError(e.message);
      setResult(null);
    }
  }

  function suggest() {
    setError("");
    if (!words) return setError("Paste some text first.");
    const r = styleEdit(input, { model });
    setEdit({ text: r.text, changes: r.changes, suggestions: r.suggestions, disclaimer: r.disclaimer });
    setCopied("");
  }

  // The AI rewrites the report to wire-service standard; the result goes into the edited text box.
  async function proEdit() {
    setError("");
    if (!words) return setError("Paste a report first.");
    setProBusy(true);
    let r;
    try {
      r = await editAsSeniorEditor(input);
    } catch {
      r = { ok: false, error: "The editor could not be reached. Check your connection and try again." };
    }
    setProBusy(false);
    if (!r.ok) return setError(r.error);
    const text = `${r.headline}\n\n${r.body}`;
    let before = null;
    let after = null;
    try { before = scoreText(input, model).score; } catch { /* too short to score */ }
    try { after = scoreText(text, model).score; } catch { /* too short to score */ }
    const s = styleEdit(text, { apply: false, model });
    setEdit({ text, changes: [], suggestions: s.suggestions, disclaimer: s.disclaimer, pro: { notes: r.notes, changes: r.changes, before, after } });
    setCopied("");
  }

  // Suggestions for the edited text as it stands now (no further automatic changes).
  function refresh(text) {
    const r = styleEdit(text, { apply: false, model });
    setEdit((e) => ({ ...e, text, suggestions: r.suggestions }));
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(edit.text);
      setCopied("Copied.");
    } catch {
      setCopied("Select the text and press Ctrl+C to copy.");
    }
  }

  if (loadError) return <div className="flag">{loadError}</div>;

  const tm = model?.training?.test_metrics;
  const editWords = edit ? tokenize(edit.text).length : 0;
  return (
    <div className="editor aic">
      {/* The original and the edited version side by side, for comparison. */}
      <div className="aic-compare">
        <div className="aic-col">
          <label>
            Text to check <span className="hint">— your original · {words} words (150+ gives a stable result)</span>
            <textarea className="body" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Paste your text here…" />
          </label>
          <div className="aic-actions">
            <button className="btn btn-approve" type="button" disabled={!model} onClick={() => check(input, "original")}>
              {model ? "CHECK TEXT" : "LOADING THE CHECKER…"}
            </button>
            <button className="btn btn-edit" type="button" disabled={!model} onClick={suggest}>SUGGEST EDITS</button>
          </div>
          <button className="btn btn-edit aic-pro" type="button" disabled={!model || proBusy} onClick={proEdit}>
            {proBusy ? `THE SENIOR EDITOR IS WORKING… ${seconds}s` : "📰 EDIT LIKE A SENIOR NEWS EDITOR"}
          </button>
        </div>

        <div className="aic-col">
          <label>
            {edit?.pro ? "Senior editor's version" : "Edited text"}{" "}
            <span className="hint">— {edit ? `${editWords} words · you can change it here` : "appears here after an edit"}</span>
            <textarea
              className="body"
              value={edit?.text ?? ""}
              readOnly={!edit}
              onChange={(e) => setEdit((x) => ({ ...x, text: e.target.value }))}
              placeholder="Tap SUGGEST EDITS or EDIT LIKE A SENIOR NEWS EDITOR. The edited version appears here, next to your original."
            />
          </label>
          <div className="aic-actions aic-actions-3">
            <button className="btn btn-edit" type="button" disabled={!edit} onClick={() => refresh(edit.text)}>UPDATE SUGGESTIONS</button>
            <button className="btn btn-edit" type="button" disabled={!edit} onClick={copy}>COPY</button>
            <button className="btn btn-approve" type="button" disabled={!edit} onClick={() => check(edit.text, "edited")}>CHECK EDITED TEXT</button>
          </div>
          {copied && <p className="note">{copied}</p>}
        </div>
      </div>

      <p className="note">
        The senior editor rewrites the report to international wire-service standard: the most important fact
        first, attribution, plain neutral English, a sentence-case headline. It must not add any fact; anything
        missing becomes a question in the editor&apos;s notes. Always check the edit against your source.
      </p>
      {model && (
        <p className="note">
          Model: {model.name}
          {tm && ` · test accuracy ${(tm.accuracy * 100).toFixed(1)}%, wrongly flagged ${(tm.falsePositiveRate * 100).toFixed(1)}% of human texts`}
        </p>
      )}
      {error && <div className="flag">{error}</div>}

      {result && (
        <section className="story aic-result" aria-live="polite">
          <h2>AI check: {result.source === "edited" ? "edited text" : "your original"}</h2>
          <div className="aic-score">
            <b>{result.score}/100</b>
            <span className={result.band === "more-ai" ? "aic-ai" : result.band === "more-human" ? "aic-human" : ""}>{result.bandText}</span>
          </div>
          <div className="aic-bar"><i style={{ left: `${result.score}%` }} /></div>
          <div className="aic-scale"><span>More human-like</span><span>More AI-like</span></div>

          {result.phrases.ai.length > 0 && (
            <>
              <h3>Words and phrases that raised the score</h3>
              <ul className="aic-chips aic-ai">{result.phrases.ai.map((p) => <li key={p}>{p}</li>)}</ul>
            </>
          )}
          {result.phrases.human.length > 0 && (
            <>
              <h3>Words and phrases that lowered it</h3>
              <ul className="aic-chips aic-human">{result.phrases.human.map((p) => <li key={p}>{p}</li>)}</ul>
            </>
          )}
          <h3>Style measures with the most weight</h3>
          <ul className="aic-list">
            {result.signals.map((s) => (
              <li key={s.feature}>
                {s.label}: <b>{s.value}</b> — <span className={s.contribution > 0 ? "aic-ai" : "aic-human"}>{s.effect}</span>
              </li>
            ))}
          </ul>
          <ul className="aic-list note">{result.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>
      )}

      {edit && (
        <section className="story aic-result" aria-live="polite">
          <h2>{edit.pro ? "Senior editor's notes" : "Style suggestions"}</h2>
          <p className="note">{edit.disclaimer}</p>

          {edit.pro && (
            <>
              {edit.pro.before !== null && edit.pro.after !== null && (
                <p className="aic-beforeafter">
                  AI-check score: <b>{edit.pro.before}/100</b> before → <b>{edit.pro.after}/100</b> after editing
                </p>
              )}
              <h3>Editor&apos;s notes: check before publishing ({edit.pro.notes.length})</h3>
              {edit.pro.notes.length ? (
                <ul className="aic-list aic-notes">{edit.pro.notes.map((n) => <li key={n}>{n}</li>)}</ul>
              ) : (
                <p className="note">No questions from the editor.</p>
              )}
              <h3>What the editor changed</h3>
              <ul className="aic-list">{edit.pro.changes.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          )}

          {!edit.pro && (
            <>
              <h3>Changed automatically ({edit.changes.length})</h3>
              {edit.changes.length ? (
                <ul className="aic-list">
                  {edit.changes.map((c) => (
                    <li key={`${c.index}-${c.from}`}><del>{c.from}</del> → <ins>{c.to}</ins></li>
                  ))}
                </ul>
              ) : (
                <p className="note">No wordy phrases found.</p>
              )}
            </>
          )}

          <h3>Sentences in the edited text that read as AI-written ({edit.suggestions.filter((s) => s.kind === "sentence").length})</h3>
          <Marked text={edit.text} suggestions={edit.suggestions} />

          <h3>For you to review ({edit.suggestions.length})</h3>
          <p className="note">Tap an option to apply it to the edited text. Keep any word that is the correct term. “Delete” removes the word or opener.</p>
          <ul className="aic-list">
            {edit.suggestions.map((s, i) => (
              <li key={`${s.kind}-${s.index ?? "x"}-${i}`}>
                {s.message}
                {s.kind === "sentence" ? (
                  <span className="aic-excerpt">“{s.excerpt}”</span>
                ) : (
                  s.excerpt && <span className="aic-excerpt">{s.excerpt}</span>
                )}
                {s.alternatives?.length > 0 && (
                  <span className="aic-alts">
                    Replace with:
                    {s.alternatives.map((a) => (
                      <button key={a || "delete"} type="button" onClick={() => refresh(applyAlternative(edit.text, s, a))}>
                        {a === "" ? "Delete" : a}
                      </button>
                    ))}
                  </span>
                )}
              </li>
            ))}
            {edit.suggestions.length === 0 && <li className="note">No suggestions.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
