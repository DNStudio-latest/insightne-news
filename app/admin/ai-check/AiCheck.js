"use client";
// The admin AI checker. It uses the same engine and trained model as the public /ai-tools/ page.
// The model (about 500 KB) loads only when this page opens.
import { useEffect, useState } from "react";
import { scoreText, styleEdit, applyAlternative, tokenize } from "../../../public/ai-tools/engine.js";
import { HANDOFF_KEY, DRAFT_KEY, leave, take } from "./handoff.js";
import { editAsSeniorEditor } from "./actions.js";
import { wordDiff, diffCounts } from "./diff.js";
import { LENGTHS } from "./lengths.js";

function takeHandoff() {
  const value = take(HANDOFF_KEY);
  return typeof value?.text === "string" ? value.text : "";
}

// Character count with the target range, e.g. "62 characters (target 55–70)".
function Count({ text, range, unit = "characters" }) {
  const n = unit === "words" ? text.split(/\s+/).filter(Boolean).length : text.length;
  const ok = n >= range[0] && n <= range[1];
  return <span className={ok ? "aic-human" : "aic-warn"}>{n} {unit} (target {range[0]}–{range[1]})</span>;
}

// The edited text compared with the original: removed words struck through, added words highlighted.
function Changes({ before, after }) {
  const segments = wordDiff(before, after);
  if (!segments) return <p className="note">The texts are too long to compare word by word.</p>;
  const { removed, added } = diffCounts(segments);
  return (
    <>
      <p className="note">
        {removed || added ? `${removed} words removed, ${added} words added.` : "No words changed."}{" "}
        <span className="aic-key"><del>removed</del> <ins>added</ins></span>
      </p>
      <div className="aic-marked aic-diff">
        {segments.map((s, i) =>
          // A paragraph break on its own is shown as a break, not as a highlighted change.
          !s.text.trim() ? <span key={i}>{s.type === "del" ? " " : s.text}</span>
            : s.type === "del" ? <del key={i}>{s.text}</del> : s.type === "ins" ? <ins key={i}>{s.text}</ins> : <span key={i}>{s.text}</span>
        ).flatMap((el, i) => {
          // A space between segments, but none next to a paragraph break.
          const touchesBreak = i && (segments[i - 1].text.endsWith("\n") || segments[i].text.startsWith("\n"));
          return i && !touchesBreak ? [" ", el] : [el];
        })}
      </div>
    </>
  );
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
    setEdit({
      text,
      changes: [],
      suggestions: s.suggestions,
      disclaimer: s.disclaimer,
      pro: { notes: r.notes, changes: r.changes, before, after, shortHeadline: r.shortHeadline, headlineOptions: r.headlineOptions, intro: r.intro },
    });
    setCopied("");
  }

  // The edited text's first paragraph is the main headline; the rest is the story.
  const splitEdited = (text) => {
    const [first, ...rest] = String(text).split(/\n\s*\n/);
    return { headline: (first || "").trim(), body: rest.join("\n\n").trim() };
  };

  // Makes an alternative headline the main one (the old main headline becomes an option).
  function useHeadline(option) {
    const { headline, body } = splitEdited(edit.text);
    const options = edit.pro.headlineOptions.map((h) => (h === option ? headline : h));
    const text = `${option}\n\n${body}`;
    const s = styleEdit(text, { apply: false, model });
    setEdit((e) => ({ ...e, text, suggestions: s.suggestions, pro: { ...e.pro, headlineOptions: options } }));
  }

  async function copyText(text, label) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(`${label} copied.`);
    } catch {
      setCopied("Select the text and press Ctrl+C to copy.");
    }
  }

  // Opens Write story in a new tab with the headline, intro and story filled in.
  function openAsStory() {
    const { headline, body } = splitEdited(edit.text);
    if (!leave(DRAFT_KEY, { headline, summary: edit.pro.intro || "", body })) {
      return setError("Your browser blocked the hand-over. Copy the headline, intro and text instead.");
    }
    window.open("/admin/write", "_blank");
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

      {edit?.pro && (
        <section className="story aic-result aic-heads">
          <h2>Headlines and intro</h2>
          <div className="aic-head">
            <h3>Main headline <Count text={splitEdited(edit.text).headline} range={LENGTHS.headline} /></h3>
            <p className="aic-headline">{splitEdited(edit.text).headline}</p>
            <button type="button" className="aic-mini" onClick={() => copyText(splitEdited(edit.text).headline, "Headline")}>Copy</button>
          </div>
          {edit.pro.shortHeadline && (
            <div className="aic-head">
              <h3>Short headline: homepage, mobile, social <Count text={edit.pro.shortHeadline} range={LENGTHS.short_headline} /></h3>
              <p className="aic-headline">{edit.pro.shortHeadline}</p>
              <button type="button" className="aic-mini" onClick={() => copyText(edit.pro.shortHeadline, "Short headline")}>Copy</button>
            </div>
          )}
          {edit.pro.headlineOptions.length > 0 && (
            <div className="aic-head">
              <h3>Other headlines</h3>
              <ul className="aic-list">
                {edit.pro.headlineOptions.map((h) => (
                  <li key={h}>
                    {h} <span className="note">({h.length} characters)</span>{" "}
                    <button type="button" className="aic-mini" onClick={() => useHeadline(h)}>Use as main headline</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {edit.pro.intro && (
            <div className="aic-head">
              <h3>Intro: shown under the headline and on the front page <Count text={edit.pro.intro} range={LENGTHS.intro} unit="words" /></h3>
              <p>{edit.pro.intro}</p>
              <button type="button" className="aic-mini" onClick={() => copyText(edit.pro.intro, "Intro")}>Copy</button>
            </div>
          )}
          <button type="button" className="btn btn-approve aic-open-story" onClick={openAsStory}>✍ OPEN AS A NEW STORY IN WRITE STORY</button>
          <p className="note">Opens Write story in a new tab with the headline, intro and story filled in. Nothing is saved or published until you send it there.</p>
          {copied && <p className="note">{copied}</p>}
        </section>
      )}

      {edit && (
        <section className="story aic-result">
          <h2>What changed</h2>
          <Changes before={input} after={edit.text} />
        </section>
      )}

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
