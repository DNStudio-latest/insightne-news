"use client";
// The PhD thesis checker. Analysis runs in the browser with public/ai-tools/academic.js and the academic model
// (about 550 KB, loaded only when this page opens). The thesis stays in this tab's memory: nothing is saved.
import { useEffect, useMemo, useState } from "react";
import {
  readDocx, paragraphsFromText, analyseThesis, applyAlternative, VOICE_LABELS, VOICE_NORMS, THESIS_DISCLAIMER, MIN_PARAGRAPH_WORDS,
  DETECTION_LIMIT, BAND_LABELS, WRITING_POINTS,
} from "../../../public/ai-tools/academic.js";
import { scoreText } from "../../../public/ai-tools/engine.js";
import { wordDiff, diffCounts } from "../ai-check/diff.js";
import { editThesisPassage } from "./actions.js";

const BAND_TEXT = BAND_LABELS;
const KIND_TEXT = { excess: "Word that rose with ChatGPT", wordy: "Wordy", pattern: "Stock formula", source: "Needs a citation", overclaim: "Overclaim", sentence: "ChatGPT-style sentence", long: "Long sentence", uniform: "Even rhythm" };
const SHOW_STEP = 120;

function Changes({ before, after }) {
  const segments = wordDiff(before, after);
  if (!segments) return <p className="note">The texts are too long to compare word by word.</p>;
  const { removed, added } = diffCounts(segments);
  return (
    <>
      <p className="note">{removed || added ? `${removed} words removed, ${added} words added.` : "No words changed."} <span className="aic-key"><del>removed</del> <ins>added</ins></span></p>
      <div className="aic-marked aic-diff">
        {segments.map((s, i) => (s.type === "del" ? <del key={i}>{s.text}</del> : s.type === "ins" ? <ins key={i}>{s.text}</ins> : <span key={i}>{s.text}</span>))
          .flatMap((el, i) => (i ? [" ", el] : [el]))}
      </div>
    </>
  );
}

// The paragraph with sentence-level flags underlined and word-level flags highlighted.
function Marked({ text, suggestions }) {
  const outerKinds = new Set(["sentence", "source", "long"]);
  const pick = (kinds) => {
    const spans = [];
    let end = -1;
    for (const s of suggestions.filter((x) => kinds(x.kind) && x.index !== undefined).sort((a, b) => a.index - b.index)) {
      if (s.index < end) continue;
      spans.push(s);
      end = s.index + s.length;
    }
    return spans;
  };
  const outer = pick((k) => outerKinds.has(k));
  const inner = pick((k) => !outerKinds.has(k) && k !== "uniform");
  const cuts = [...new Set([0, text.length, ...[...outer, ...inner].flatMap((s) => [s.index, s.index + s.length])])].filter((x) => x >= 0 && x <= text.length).sort((a, b) => a - b);
  const cover = (spans, at) => spans.find((s) => at >= s.index && at < s.index + s.length);
  const parts = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const piece = text.slice(cuts[i], cuts[i + 1]);
    const o = cover(outer, cuts[i]);
    const n = cover(inner, cuts[i]);
    let el = piece;
    if (n) el = <mark key={`m${i}`} className={`tc-${n.kind}`} title={n.message}>{piece}</mark>;
    if (o) el = <span key={`s${i}`} className={`tc-under tc-${o.kind}`} title={o.message}>{el}</span>;
    parts.push(typeof el === "string" ? <span key={`t${i}`}>{el}</span> : el);
  }
  return <p className="tc-text">{parts}</p>;
}

function Voice({ voice }) {
  if (!VOICE_NORMS || !voice?.words) return null;
  const rows = ["selfMention", "hedges", "boosters", "attitude", "frameMarkers", "transitions", "excessWords", "citations"];
  return (
    <section className="story aic-result">
      <h2>Your voice in numbers</h2>
      <p className="note">
        Per 1,000 of your own words, next to the averages for human and ChatGPT abstracts in the humanities and social
        sciences (GPABench2). Corpus studies find that AI text uses fewer self-mentions and more frame markers, and the
        words that rose with ChatGPT. Abstracts are denser than chapters, so read these as directions, not targets.
      </p>
      <div className="tc-table-wrap">
        <table className="tc-table">
          <thead><tr><th>Measure</th><th>Your text</th><th>Human abstracts</th><th>AI abstracts</th></tr></thead>
          <tbody>
            {rows.map((k) => {
              const you = voice.rates[k];
              const h = VOICE_NORMS.human[k]?.mean;
              const a = VOICE_NORMS.ai[k]?.mean;
              const nearer = Math.abs(you - a) < Math.abs(you - h) && Math.abs(h - a) > 1 ? "aic-ai" : "";
              return <tr key={k}><td>{VOICE_LABELS[k]}</td><td className={nearer}>{you}</td><td>{h}</td><td>{a}</td></tr>;
            })}
            <tr><td>Average sentence length (words)</td><td>{voice.meanSentence}</td><td>{VOICE_NORMS.human.meanSentence.mean}</td><td>{VOICE_NORMS.ai.meanSentence.mean}</td></tr>
            <tr><td>Variation in sentence length (higher = more varied)</td><td>{voice.sentenceVariation}</td><td>{VOICE_NORMS.human.sentenceVariation.mean}</td><td>{VOICE_NORMS.ai.sentenceVariation.mean}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="note">Red: your figure is nearer the AI average than the human one.</p>
    </section>
  );
}

function Paragraph({ p, model, mode, onChange }) {
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  useEffect(() => {
    if (!busy) return setSeconds(0);
    const t = setInterval(() => setSeconds((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  async function runEditor() {
    setBusy(true);
    setError("");
    let r;
    try {
      r = await editThesisPassage(p.text, mode);
    } catch {
      r = { ok: false, error: "The editor could not be reached. Check your connection and try again." };
    }
    setBusy(false);
    if (!r.ok) return setError(r.error);
    let after = null;
    try { after = scoreText(r.edited, model).score; } catch { /* too short */ }
    setEdit({ ...r, after });
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setCopied("Copied."); } catch { setCopied("Select the text and press Ctrl+C to copy."); }
  }
  const tips = (p.suggestions || []).filter((s) => s.kind !== "sentence");
  return (
    <article className={`tc-para tc-band-${p.band || "none"}`} id={`p${p.index}`}>
      <header className="tc-para-head">
        <span className="tc-section">{p.section}</span>
        {p.score !== undefined
          ? <b className={p.band === "ai" ? "aic-ai" : p.band === "human" ? "" : "aic-warn"}>{p.score}/100 · {BAND_TEXT[p.band]}</b>
          : <span className="note">{p.words} words: too short to score on its own (counted in its section)</span>}
      </header>
      <Marked text={p.text} suggestions={p.suggestions || []} />
      {p.cues?.length > 0 && <p className="note">Words that raised the score most: {p.cues.map((c) => `“${c}”`).join(", ")}</p>}
      {tips.length > 0 && (
        <ul className="aic-list tc-tips">
          {tips.map((s, i) => (
            <li key={i}>
              <span className={`tc-tag tc-${s.kind}`}>{KIND_TEXT[s.kind] || s.kind}</span> {s.message}
              {s.alternatives?.length > 0 && (
                <span className="aic-alts">
                  Replace &ldquo;{s.phrase}&rdquo; with:
                  {s.alternatives.map((alt) => (
                    <button key={alt || "delete"} type="button" onClick={() => onChange(applyAlternative(p.text, s, alt))}>{alt || "(delete)"}</button>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="tc-para-actions">
        <button className="btn btn-edit" type="button" disabled={busy} onClick={runEditor}>
          {busy ? `THE ACADEMIC EDITOR IS WORKING… ${seconds}s` : "🎓 EDIT WITH THE ACADEMIC EDITOR"}
        </button>
      </div>
      {error && <div className="flag">{error}</div>}
      {edit && (
        <div className="tc-edit">
          <div className="aic-compare">
            <div className="aic-col"><h3>Your text {p.score !== undefined && <span className="note">· {p.score}/100</span>}</h3><p className="tc-text">{p.text}</p></div>
            <div className="aic-col">
              <h3>Academic editor ({edit.mode}) {edit.after !== null && <span className="note">· {edit.after}/100</span>}</h3>
              <textarea className="body tc-edited" value={edit.edited} onChange={(e) => setEdit((x) => ({ ...x, edited: e.target.value }))} />
            </div>
          </div>
          <h3>What changed</h3>
          <Changes before={p.text} after={edit.edited} />
          {edit.notes.length > 0 && (<><h3>Editor&apos;s notes for you</h3><ul className="aic-list aic-notes">{edit.notes.map((n, i) => <li key={i}>{n}</li>)}</ul></>)}
          {edit.changes.length > 0 && (<><h3>Main edits</h3><ul className="aic-list">{edit.changes.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
          <div className="aic-actions aic-actions-3">
            <button className="btn btn-approve" type="button" onClick={() => { onChange(edit.edited); setEdit(null); }}>USE THE EDITED VERSION</button>
            <button className="btn btn-edit" type="button" onClick={() => copy(edit.edited)}>COPY</button>
            <button className="btn btn-plain" type="button" onClick={() => setEdit(null)}>DISCARD</button>
          </div>
          {copied && <p className="note">{copied}</p>}
          <p className="note">Check every change against your sources and data. The editor must not add facts or citations; the notes list anything it found missing.</p>
        </div>
      )}
    </article>
  );
}

export default function ThesisCheck() {
  const [model, setModel] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [paste, setPaste] = useState("");
  const [paras, setParas] = useState(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("attention");
  const [shown, setShown] = useState(SHOW_STEP);
  const [mode, setMode] = useState("light");

  useEffect(() => {
    import("../../../public/ai-tools/model-academic.js")
      .then((m) => setModel(m.ACADEMIC_MODEL))
      .catch(() => setLoadError("The checker could not load. Check your connection and reload the page."));
  }, []);

  const analysis = useMemo(() => (paras && model ? analyseThesis(paras, model) : null), [paras, model]);

  async function openFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      const list = /\.docx$/i.test(file.name) ? await readDocx(await file.arrayBuffer()) : paragraphsFromText(await file.text());
      if (!list.some((p) => p.text)) throw new Error("No text was found in this file.");
      setFileName(file.name);
      setParas(list);
      setShown(SHOW_STEP);
    } catch (err) {
      setError(/\.(pdf|doc)$/i.test(file.name) ? "Only .docx and .txt files can be opened. In Word, use File → Save As → Word Document (.docx), or copy the text and paste it." : err.message);
    }
    e.target.value = "";
  }
  function checkPasted() {
    setError("");
    const list = paragraphsFromText(paste);
    if (!list.length) return setError("Paste some text first.");
    setFileName("Pasted text");
    setParas(list);
    setShown(SHOW_STEP);
  }
  const change = (index, text) => setParas((list) => list.map((p, i) => (i === index ? { ...p, text } : p)));
  function download() {
    const text = paras.map((p) => p.text).join("\n\n");
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(fileName || "thesis").replace(/\.[^.]+$/, "")}-revised.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loadError) return <div className="flag">{loadError}</div>;
  const visible = analysis
    ? analysis.paragraphs.filter((p) => (p.kind === "prose" || p.kind === "list") && (
      filter === "all" ||
      (filter === "ai" && p.band === "ai") ||
      (filter === "attention" && (p.band === "ai" || p.band === "mixed" || (p.suggestions || []).some((s) => ["source", "overclaim", "pattern", "sentence"].includes(s.kind))))
    ))
    : [];
  const s = analysis?.summary;
  const tm = model?.training?.test_metrics;
  return (
    <div className="editor aic tc">
      <section className="story aic-result">
        <h2>1. Open a chapter</h2>
        <label>Word or text file <span className="hint">— .docx or .txt; for a PDF, save it as .docx first</span>
          <input type="file" accept=".docx,.txt,.md,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={openFile} disabled={!model} />
        </label>
        <label>Or paste text <span className="hint">— leave a blank line between paragraphs</span>
          <textarea className="body tc-paste" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="Paste a chapter or a few paragraphs here…" />
        </label>
        <button className="btn btn-approve" type="button" disabled={!model} onClick={checkPasted}>{model ? "CHECK PASTED TEXT" : "LOADING THE CHECKER…"}</button>
        {error && <div className="flag">{error}</div>}
        {model && <p className="note">Model: {model.name}{tm && ` · right on ${(tm.accuracy * 100).toFixed(1)}% of ${tm.n.toLocaleString("en")} test abstracts`}{model.training?.at_ai_threshold && `; at the "AI-like" level it flags ${(model.training.at_ai_threshold.falsePositiveRate * 100).toFixed(1)}% of human abstracts`}.</p>}
      </section>

      {analysis && (
        <>
          <section className="story aic-result" aria-live="polite">
            <h2>2. Overview: {fileName}</h2>
            <p>
              {s.words.toLocaleString("en")} words of your own prose were analysed
              ({s.counts.heading || 0} headings, {s.counts.quote || 0} quotations and interview extracts, {s.counts.table || 0} table cells,
              {" "}{s.counts.caption || 0} captions and {s.counts.reference || 0} references were left out).
            </p>
            <h3>Writing points</h3>
            {WRITING_POINTS.some(([k]) => s.writing[k]) ? (
              <ul className="aic-list">
                {WRITING_POINTS.filter(([k]) => s.writing[k]).map(([k, label]) => <li key={k}><b>{s.writing[k]}</b> {label}</li>)}
              </ul>
            ) : <p>No writing points found.</p>}
            <h3>ChatGPT-style signal</h3>
            <div className="flag"><strong>What this can show.</strong> {DETECTION_LIMIT}</div>
            {s.scoredWords > 0 ? (
              <>
                <div className="tc-shares">
                  <span className="tc-share tc-band-ai" style={{ flexGrow: s.shares.ai || 0.0001 }} />
                  <span className="tc-share tc-band-mixed" style={{ flexGrow: s.shares.mixed || 0.0001 }} />
                  <span className="tc-share tc-band-human" style={{ flexGrow: s.shares.human || 0.0001 }} />
                </div>
                <p>
                  <b className="aic-ai">{s.shares.ai}%</b> of the scored words are in paragraphs with a ChatGPT-style signal,{" "}
                  <b className="aic-warn">{s.shares.mixed}%</b> with a weak signal and{" "}
                  <b>{s.shares.human}%</b> with no ChatGPT-style signal found.
                  {s.shortWords > 0 && ` ${s.shortWords.toLocaleString("en")} words are in paragraphs under ${MIN_PARAGRAPH_WORDS} words, which are scored only with their section.`}
                </p>
              </>
            ) : <p className="note">No paragraph is long enough to score on its own ({MIN_PARAGRAPH_WORDS}+ words).</p>}
            <p className="note">{THESIS_DISCLAIMER}</p>
            <div className="aic-actions">
              <button className="btn btn-edit" type="button" onClick={download}>DOWNLOAD REVISED TEXT (.TXT)</button>
              <a className="btn btn-plain" href="#tc-paragraphs">GO TO THE PARAGRAPHS</a>
            </div>
            <p className="note">Your changes are kept only in this tab. Download the revised text before you close it, then copy the paragraphs you want into your Word file.</p>
          </section>

          {analysis.sections.length > 1 && (
            <section className="story aic-result">
              <h2>Sections</h2>
              <ul className="tc-sections">
                {analysis.sections.map((sec, i) => (
                  <li key={i}>
                    <a href={`#p${sec.paragraphs[0]}`}>{sec.title}</a>
                    <span className="note"> · {sec.words.toLocaleString("en")} words</span>
                    {sec.score !== undefined && <b className={sec.band === "ai" ? "aic-ai" : sec.band === "human" ? "" : "aic-warn"}> · {sec.score}/100</b>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Voice voice={analysis.voice} />

          <section className="story aic-result" id="tc-paragraphs">
            <h2>3. Paragraphs</h2>
            <div className="tc-controls">
              <label>Show
                <select value={filter} onChange={(e) => { setFilter(e.target.value); setShown(SHOW_STEP); }}>
                  <option value="attention">Paragraphs that need attention</option>
                  <option value="ai">Only paragraphs with a ChatGPT-style signal</option>
                  <option value="all">All paragraphs</option>
                </select>
              </label>
              <label>Academic editor
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  <option value="light">Light: language only</option>
                  <option value="thorough">Thorough: language and sentence structure</option>
                </select>
              </label>
            </div>
            <p className="note">
              <mark className="tc-excess">Highlighted</mark> words and phrases have a suggestion; <span className="tc-under tc-sentence">underlined</span> sentences
              have a ChatGPT-style signal or need a citation. Hover over a mark to see why. The academic editor sends only that paragraph to the
              website&apos;s AI; it keeps your citations, quotations, figures and terms, and lists anything missing as a note.
            </p>
            {visible.length === 0 && <p>Nothing to show with this filter.</p>}
            {visible.slice(0, shown).map((p) => (
              <Paragraph key={`${p.index}:${p.text.length}`} p={p} model={model} mode={mode} onChange={(text) => change(p.index, text)} />
            ))}
            {visible.length > shown && <button className="btn btn-edit" type="button" onClick={() => setShown((n) => n + SHOW_STEP)}>SHOW MORE ({visible.length - shown} left)</button>}
          </section>
        </>
      )}
    </div>
  );
}
