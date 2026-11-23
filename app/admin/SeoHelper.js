"use client";
// "Google check" panel for the story forms: live warnings about the headline and intro, and a button that asks the
// AI for search-friendly headlines and a description. It only fills the boxes when the editor clicks "Use this".
import { useEffect, useRef, useState } from "react";
import { seoChecks, LEVEL_ICON } from "../../lib/seo-check.js";

const COLOR = { ok: "var(--ok, #1a7f4b)", warn: "var(--warn, #b26a00)", bad: "var(--danger, #b3261e)" };

export default function SeoHelper() {
  const box = useRef(null);
  const [checks, setChecks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const read = () => {
    const form = box.current?.closest("form");
    const v = (name) => form?.elements?.[name]?.value || "";
    return { form, headline: v("headline"), summary: v("summary"), body: v("body"), region: v("region") };
  };

  useEffect(() => {
    const form = box.current?.closest("form");
    if (!form) return undefined;
    const update = () => {
      const { headline, summary, region } = read();
      setChecks(seoChecks({ headline, summary, region }));
    };
    update();
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
    };
  }, []);

  async function suggest() {
    const { headline, summary, body, region } = read();
    setBusy(true);
    setError("");
    setResult(null);
    const stop = new AbortController();
    const timer = setTimeout(() => stop.abort(), 45000);
    try {
      const res = await fetch("/api/seo-suggest", { method: "POST", signal: stop.signal, headers: { "content-type": "application/json" }, body: JSON.stringify({ headline, summary, body, region }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(err.name === "AbortError" ? "No answer after 45 seconds. Press the button again in a minute." : err.message);
    } finally {
      clearTimeout(timer);
      setBusy(false);
    }
  }

  // Puts text into a box the way typing would, so the live check and the form both see it.
  function fill(name, value) {
    const el = box.current?.closest("form")?.elements?.[name];
    if (!el) return;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return (
    <div ref={box} className="run-box seo-helper" style={{ margin: "10px 0" }}>
      <strong>🔎 Google check</strong> <span className="hint">— how this headline and intro will look in search</span>
      <ul style={{ listStyle: "none", padding: 0, margin: "6px 0" }}>
        {checks.map((c, i) => (
          <li key={i} style={{ color: COLOR[c.level], margin: "3px 0" }}>
            <strong>{LEVEL_ICON[c.level]}</strong> {c.text}
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-approve" onClick={suggest} disabled={busy}>
        {busy ? "Thinking…" : "✨ Make search-friendly"}
      </button>
      <span className="hint"> Gives 3 headlines and a description. You choose; nothing changes until you click “Use this”.</span>
      {error && <p style={{ color: COLOR.bad }}>✗ {error}</p>}
      {result && (
        <div style={{ marginTop: 8 }}>
          {result.headlines.map((h, i) => (
            <div key={i} style={{ margin: "6px 0", padding: 6, border: "1px solid var(--line, #ddd)", borderRadius: 6 }}>
              <div><strong>{h.text}</strong> <span className="hint">({h.length} characters)</span></div>
              {h.check?.length > 0 && <div style={{ color: COLOR.warn }}>Check these words are true: {h.check.join(", ")} (not in your text)</div>}
              <button type="button" className="btn btn-plain" onClick={() => fill("headline", h.text)}>Use this headline</button>
            </div>
          ))}
          {result.description && (
            <div style={{ margin: "6px 0", padding: 6, border: "1px solid var(--line, #ddd)", borderRadius: 6 }}>
              <div>{result.description} <span className="hint">({[...result.description].length} characters)</span></div>
              {result.descriptionCheck?.length > 0 && <div style={{ color: COLOR.warn }}>Check these words are true: {result.descriptionCheck.join(", ")} (not in your text)</div>}
              <button type="button" className="btn btn-plain" onClick={() => fill("summary", result.description)}>Use as intro (replaces your intro)</button>
            </div>
          )}
          <span className="hint">Made by {result.provider === "gemini" ? "Gemini" : "Claude"}. Read every word against your source before you save.</span>
        </div>
      )}
    </div>
  );
}
