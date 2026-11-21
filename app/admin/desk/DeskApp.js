"use client";
// The phone "News desk". Five steps, like the Windows InsightNE News Tool:
// 1 Source (caption, speaker, clip, photo), 2 Gemini, 3 ChatGPT, 4 Story, 5 Review and send.
// The work is saved on the website as you type (nothing lives only in the phone), and nothing is ever deleted
// except by the Delete button on an item.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { saveDeskItem, deleteDeskItem, uploadDeskPhoto, uploadDraft, publishNow } from "./actions.js";
import { shrinkPhoto } from "../photo.js";
import { makeMp3 } from "./audio.js";
import { GEMINI_PROMPT, chatGptMessage } from "../../../lib/desk-prompts.js";
import { deskWarnings } from "../../../lib/desk-checks.js";

const STEPS = ["Source", "Gemini", "ChatGPT", "Story", "Review"];
const FIELDS = ["title", "caption_bn", "speakers", "gemini_text", "chatgpt_out", "headline", "intro", "story", "photo_caption", "photo_credit", "photo_url", "no_video", "no_photo"];

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// Which step should the item open on? The first one that still has work to do.
function nextStep(it) {
  if (!it.caption_bn?.trim()) return 0;
  if (!it.no_video && !it.gemini_text?.trim()) return 1;
  if (!it.chatgpt_out?.trim()) return 2;
  if (!it.story?.trim() || !it.headline?.trim() || !it.intro?.trim()) return 3;
  return 4;
}

// Splits ChatGPT's reply: first non-empty line = headline, the rest = story (from the dateline lead).
// The reply itself is kept unedited in chatgpt_out; this only fills the boxes, which you can change.
function splitReply(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n");
  const first = lines.findIndex((l) => l.trim());
  if (first < 0) return { headline: "", story: "" };
  const headline = lines[first].replace(/^#+\s*/, "").replace(/^\*+|\*+$/g, "").trim();
  const story = lines.slice(first + 1).join("\n").trim();
  return { headline, story };
}

export default function DeskApp({ initialItems, canPublish, autoPost }) {
  const [items, setItems] = useState(initialItems);
  const [openId, setOpenId] = useState(null);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState("");
  const [saveState, setSaveState] = useState("");
  const [audio, setAudio] = useState({}); // item id -> [{ name, url, blob, seconds, bytes }]
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState("");
  const timers = useRef({});
  const pending = useRef({});

  const item = useMemo(() => items.find((i) => i.id === openId) || null, [items, openId]);

  const flush = useCallback(async (id) => {
    const patch = pending.current[id];
    if (!patch) return;
    delete pending.current[id];
    setSaveState("Saving...");
    const r = await saveDeskItem({ id, ...patch });
    if (r.ok) setSaveState("Saved on the website ✓");
    else {
      pending.current[id] = { ...patch, ...(pending.current[id] || {}) };
      setSaveState(`NOT saved: ${r.error}`);
    }
  }, []);

  const change = useCallback((id, patch) => {
    setItems((all) => all.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    pending.current[id] = { ...(pending.current[id] || {}), ...patch };
    setSaveState("Typing...");
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => flush(id), 1500);
  }, [flush]);

  // Save at once when the phone leaves the page or the app goes to the background (e.g. when you switch to the Gemini app).
  useEffect(() => {
    const now = () => Object.keys(pending.current).forEach((id) => flush(id));
    const vis = () => document.visibilityState === "hidden" && now();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("pagehide", now);
    return () => {
      document.removeEventListener("visibilitychange", vis);
      window.removeEventListener("pagehide", now);
    };
  }, [flush]);

  async function newItem() {
    const r = await saveDeskItem({ title: "New item", caption_bn: "" });
    if (!r.ok) return setStatus(r.error);
    setItems((a) => [r.item, ...a]);
    setOpenId(r.item.id);
    setStep(0);
  }

  function open(it) {
    setOpenId(it.id);
    setStep(nextStep(it));
    setStatus("");
  }

  async function back() {
    if (openId) await flush(openId);
    setStep(0);
    setOpenId(null);
    setStatus("");
  }

  async function remove(it) {
    if (!confirm(`Delete "${it.title}" from the News desk?\n\nThis cannot be undone. A draft already on the website is NOT deleted.`)) return;
    await deleteDeskItem(it.id);
    setItems((a) => a.filter((x) => x.id !== it.id));
    setOpenId(null);
  }

  // ---- list ----
  if (!item) {
    return (
      <Shell>
        <div className="d-top">
          <h1>News desk</h1>
          <a className="d-link" href="/admin">Approvals</a>
        </div>
        <button className="d-big" onClick={newItem}>+ New item</button>
        {status && <p className="d-err">{status}</p>}
        {items.length === 0 && <p className="d-muted">No items yet. Tap “New item”, paste the Bengali caption from WhatsApp and follow the five steps.</p>}
        <ul className="d-list">
          {items.map((it) => {
            const s = it.published ? "Published" : it.draft_story_id ? "Draft on website" : ["Needs caption", "Needs Gemini", "Needs ChatGPT", "Needs story", "Ready to review"][nextStep(it)];
            return (
              <li key={it.id}>
                <button onClick={() => open(it)}>
                  <strong>{it.headline || it.title}</strong>
                  <span className={it.published ? "d-tag ok" : it.draft_story_id ? "d-tag" : "d-tag warn"}>{s}</span>
                  <small>{new Date(it.updated_at || it.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
                </button>
              </li>
            );
          })}
        </ul>
      </Shell>
    );
  }

  const files = audio[item.id] || [];
  const warn = deskWarnings(item);
  const set = (patch) => change(item.id, patch);

  async function addClips(list) {
    const arr = [...list];
    for (const f of arr) {
      setBusy("audio");
      setProgress({ p: 0, text: `Starting ${f.name}...` });
      try {
        const r = await makeMp3(f, (p, text) => setProgress({ p, text: `${f.name}: ${text}` }));
        const n = (audio[item.id] || []).length + 1;
        const name = n === 1 ? "gemini-audio.mp3" : `gemini-audio-${n}.mp3`;
        const file = new File([r.blob], name, { type: "audio/mpeg" });
        setAudio((a) => ({ ...a, [item.id]: [...(a[item.id] || []), { name, file, url: URL.createObjectURL(r.blob), seconds: r.seconds, bytes: r.bytes }] }));
        set({ no_video: false });
        setStatus(`${name} is ready: ${(r.bytes / 1024).toFixed(0)} KB, ${Math.round(r.seconds)} seconds. Original video size was ${(f.size / 1048576).toFixed(1)} MB.`);
      } catch (e) {
        setStatus(e.message);
      }
    }
    setBusy("");
    setProgress(null);
  }

  async function shareAudio() {
    const list = (audio[item.id] || []).map((a) => a.file);
    if (!list.length) return;
    try {
      if (navigator.canShare && navigator.canShare({ files: list })) await navigator.share({ files: list });
      else setStatus("Your phone cannot share these straight away. Use “Save audio” and attach it in Gemini with the + button.");
    } catch (e) {
      if (e?.name !== "AbortError") setStatus(`Share did not work: ${e.message}`);
    }
  }

  async function addPhotos(list) {
    const arr = [...list].slice(0, 1);
    for (const f of arr) {
      setBusy("photo");
      const small = await shrinkPhoto(f);
      const fd = new FormData();
      fd.append("photo", small);
      const r = await uploadDeskPhoto(fd);
      if (r.ok) {
        set({ photo_url: r.url, no_photo: false });
        setStatus("Photo added. Write its caption in step 4 (only what is visible).");
      } else setStatus(r.error);
    }
    setBusy("");
  }

  async function takeReply() {
    const r = splitReply(item.chatgpt_out);
    if (!r.story) return setStatus("Paste ChatGPT's reply first.");
    const patch = { story: r.story };
    if (!item.headline?.trim()) patch.headline = r.headline;
    set(patch);
    setStep(3);
    setStatus("Story boxes filled from ChatGPT's reply (the reply itself stays saved unedited). Now check the headline, write the intro and the photo caption.");
  }

  async function upload() {
    setBusy("upload");
    await flush(item.id);
    const r = await uploadDraft(item.id);
    setBusy("");
    if (!r.ok) return setStatus(r.error);
    setItems((a) => a.map((i) => (i.id === item.id ? r.item : i)));
    setStatus("Saved on the website as an unpublished DRAFT. It is not live.");
  }

  async function publish() {
    if (!canPublish) return setStatus("Only the admin can publish.");
    const reds = warn.red, ambers = warn.amber;
    if (!confirm(`Publish "${item.headline}" now?\n\n${reds} RED and ${ambers} AMBER warning(s) are open.${autoPost ? "\n\nAfter publishing, the website may also post it to Facebook and Instagram by itself." : ""}`)) return;
    if (!confirm("Second check: you have listened to the clip against Gemini's text, checked names, numbers and quotes, and you decide to publish. Publish?")) return;
    setBusy("publish");
    await flush(item.id);
    const r = await publishNow(item.id, "PUBLISH");
    setBusy("");
    if (!r.ok) return setStatus(r.error);
    setItems((a) => a.map((i) => (i.id === item.id ? r.item : i)));
    setStatus("Published on the website.");
  }

  const uploadedSame = item.draft_story_id && item.uploaded_hash;
  return (
    <Shell>
      <div className="d-top">
        <button className="d-link" onClick={back}>← Items</button>
        <span className="d-save">{saveState}</span>
      </div>
      <input className="d-title" value={item.title || ""} onChange={(e) => set({ title: e.target.value })} aria-label="Item name" />
      <nav className="d-steps" aria-label="Steps">
        {STEPS.map((s, i) => (
          <button key={s} className={i === step ? "on" : ""} onClick={() => { setStep(i); setStatus(""); }}>
            <b>{i + 1}</b> {s}
          </button>
        ))}
      </nav>

      {step === 0 && (
        <section>
          <label>Bengali caption (paste from WhatsApp)</label>
          <textarea rows={9} value={item.caption_bn || ""} onChange={(e) => set({ caption_bn: e.target.value })} placeholder="Paste the caption exactly as sent" />
          <label>Who is speaking in the clip? Name and designation</label>
          <textarea rows={2} value={item.speakers || ""} onChange={(e) => set({ speakers: e.target.value })} placeholder="e.g. Dr Manik Saha, Chief Minister of Tripura (one line per speaker)" />
          <p className="d-muted">Type a name only if you know it. It is sent to ChatGPT as source material.</p>

          <label>Video or audio clip(s)</label>
          <label className="d-file">
            Choose clip(s) from your phone
            <input type="file" accept="video/*,audio/*" multiple onChange={(e) => e.target.files.length && addClips(e.target.files)} />
          </label>
          <p className="d-muted">The phone takes only the sound out and makes a small MP3 (about 0.25 MB per minute). The video stays on your phone and is never uploaded.</p>
          {progress && (
            <div className="d-prog"><div style={{ width: `${Math.round(progress.p * 100)}%` }} /><span>{progress.text}</span></div>
          )}
          {files.map((a) => (
            <p key={a.name} className="d-chip">🎧 {a.name}: {(a.bytes / 1024).toFixed(0)} KB, {Math.round(a.seconds)} s <a href={a.url} download={a.name}>Save audio</a></p>
          ))}
          <label className="d-check"><input type="checkbox" checked={Boolean(item.no_video)} onChange={(e) => set({ no_video: e.target.checked })} /> This item has no video or audio</label>

          <label>Photo</label>
          {item.photo_url && <img className="d-photo" src={item.photo_url} alt="Chosen photo" />}
          <label className="d-file">
            {item.photo_url ? "Choose another photo" : "Choose a photo"}
            <input type="file" accept="image/*" onChange={(e) => e.target.files.length && addPhotos(e.target.files)} />
          </label>
          <label className="d-check"><input type="checkbox" checked={Boolean(item.no_photo)} onChange={(e) => set({ no_photo: e.target.checked, ...(e.target.checked ? { photo_url: "" } : {}) })} /> No photo for this story</label>
          <button className="d-big" onClick={() => setStep(item.no_video ? 2 : 1)}>Next</button>
        </section>
      )}

      {step === 1 && (
        <section>
          {item.no_video ? <p className="d-muted">This item has no clip, so the Gemini step is skipped.</p> : (
            <>
              <ol className="d-how">
                <li>Tap <b>Copy Gemini prompt</b>.</li>
                <li>Tap <b>Share audio to Gemini</b> and choose the Gemini app (or open Gemini and attach the saved MP3 with +). {files.length ? "" : "Add the clip in step 1 first."}</li>
                <li>Paste the prompt, send, wait for the reply, copy it and paste it below.</li>
              </ol>
              <button className="d-big" onClick={async () => setStatus((await copyText(GEMINI_PROMPT)) ? "Gemini prompt copied." : "Could not copy. Select the text below and copy it by hand.")}>Copy Gemini prompt</button>
              <details><summary>See the prompt</summary><pre>{GEMINI_PROMPT}</pre></details>
              <button className="d-big alt" disabled={!files.length} onClick={shareAudio}>Share audio to Gemini</button>
              <a className="d-big alt d-a" href="https://gemini.google.com/app">Open Gemini</a>
              <label>Gemini's reply (Bengali transcript and English, with times)</label>
              <textarea rows={12} value={item.gemini_text || ""} onChange={(e) => set({ gemini_text: e.target.value })} placeholder="Paste Gemini's reply here, exactly as it is" />
              <p className="d-muted">Gemini's translation is a machine translation. Listen to the clip against it before you trust names, numbers and quotes.</p>
            </>
          )}
          <button className="d-big" onClick={() => setStep(2)}>Next</button>
        </section>
      )}

      {step === 2 && (
        <section>
          <ol className="d-how">
            <li>Tap <b>Copy message for ChatGPT</b>.</li>
            <li>Open the ChatGPT app, paste, send.</li>
            <li>Copy ChatGPT's reply and paste it below.</li>
          </ol>
          <button
            className="d-big"
            disabled={!item.caption_bn?.trim()}
            onClick={async () => setStatus((await copyText(chatGptMessage(item))) ? "Message copied: the fixed command, the caption, the speaker and Gemini's reply. Paste it in ChatGPT." : "Could not copy. Open “See the message” and copy it by hand.")}
          >
            Copy message for ChatGPT
          </button>
          <a className="d-big alt d-a" href="https://chatgpt.com/">Open ChatGPT</a>
          <details><summary>See the message</summary><pre>{chatGptMessage(item)}</pre></details>
          <label>ChatGPT's reply (kept exactly as pasted)</label>
          <textarea rows={14} value={item.chatgpt_out || ""} onChange={(e) => set({ chatgpt_out: e.target.value })} placeholder="Paste ChatGPT's reply here" />
          <button className="d-big" disabled={!item.chatgpt_out?.trim()} onClick={takeReply}>Fill the story from this reply</button>
        </section>
      )}

      {step === 3 && (
        <section>
          <label>Headline</label>
          <textarea rows={2} value={item.headline || ""} onChange={(e) => set({ headline: e.target.value })} />
          <label>Intro (1-2 sentences, no dateline, only facts in the story)</label>
          <textarea rows={3} value={item.intro || ""} onChange={(e) => set({ intro: e.target.value })} />
          <label>Story text (starts with the dateline, e.g. “Agartala, Nov 21:”)</label>
          <textarea rows={16} value={item.story || ""} onChange={(e) => set({ story: e.target.value })} />
          <label>Photo caption (only what is visible in the picture)</label>
          <textarea rows={2} value={item.photo_caption || ""} onChange={(e) => set({ photo_caption: e.target.value })} />
          <label>Photo credit</label>
          <input value={item.photo_credit || ""} onChange={(e) => set({ photo_credit: e.target.value })} />
          <button className="d-big" onClick={() => setStep(4)}>Review</button>
        </section>
      )}

      {step === 4 && (
        <section>
          <div className={warn.red ? "d-banner red" : warn.amber ? "d-banner amber" : "d-banner green"}>
            {!item.story?.trim() ? "No story yet (step 4)" : warn.red ? `${warn.red} RED and ${warn.amber} AMBER warning(s). Read them, then you decide.` : warn.amber ? `${warn.amber} AMBER warning(s). Read them, then you decide.` : "No warnings found"}
          </div>
          <ul className="d-warn">
            {warn.rows.map((r, i) => (
              <li key={i} className={r.level === "RED" ? "red" : "amber"}>
                <details>
                  <summary><b>{r.level}</b> · {r.area}: {r.what}</summary>
                  <p>{r.detail}</p>
                </details>
              </li>
            ))}
          </ul>
          <p className="d-muted">Warnings only, nothing is blocked. They are not legal advice.</p>
          <button className="d-big" disabled={busy === "upload"} onClick={upload}>{busy === "upload" ? "Uploading..." : item.draft_story_id ? "Upload as draft again" : "Upload as draft"}</button>
          {item.draft_story_id && (
            <p className="d-chip">{item.published ? "✅ Published on the website." : uploadedSame && item.uploaded_hash ? "📝 A draft is on the website (not live)." : ""} <a href={`/admin/write?id=${item.draft_story_id}`}>Open it on the website</a></p>
          )}
          <button className="d-big danger" disabled={!canPublish || busy === "publish" || item.published || !item.draft_story_id} onClick={publish}>
            {item.published ? "Already published" : "Publish"}
          </button>
          {!canPublish && <p className="d-muted">Only the admin can publish. Your draft waits in Pending.</p>}
          {!item.draft_story_id && <p className="d-muted">Publish is available after you upload the draft. If you change the text afterwards, upload the draft again.</p>}
        </section>
      )}

      {status && <p className="d-status" role="status">{status}</p>}
      <button className="d-del" onClick={() => remove(item)}>Delete this item</button>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="desk">
      {children}
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.desk { max-width: 640px; margin: 0 auto; padding: 14px 16px 60px; font-size: 16px; }
.desk h1 { font-size: 1.5rem; margin: 0; }
.desk label { display: block; font-weight: 700; margin: 16px 0 6px; }
.desk textarea, .desk input[type=text], .desk input:not([type]) { width: 100%; box-sizing: border-box; font: inherit; padding: 10px; border: 1px solid var(--line, #ccc); border-radius: 10px; background: var(--card, #fff); color: inherit; }
.desk textarea { resize: vertical; line-height: 1.45; }
.d-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.d-link { background: none; border: 0; color: inherit; font: inherit; font-weight: 700; text-decoration: underline; padding: 6px 0; cursor: pointer; }
.d-save { font-size: 0.8rem; color: var(--muted, #666); }
.d-title { font-weight: 800; font-size: 1.15rem; margin-bottom: 10px; }
.d-big { display: block; width: 100%; box-sizing: border-box; padding: 14px; margin: 12px 0; border-radius: 12px; border: 0; background: #0f4c5c; color: #fff; font: inherit; font-weight: 800; text-align: center; cursor: pointer; text-decoration: none; }
.d-big.alt { background: var(--card, #fff); color: inherit; border: 1px solid var(--line, #ccc); }
.d-big.danger { background: #b3261e; }
.d-big:disabled { opacity: 0.45; cursor: not-allowed; }
.d-steps { display: grid; grid-template-columns: repeat(5, 1fr); gap: 4px; margin: 8px 0 14px; }
.d-steps button { padding: 8px 2px; border-radius: 8px; border: 1px solid var(--line, #ccc); background: var(--card, #fff); color: inherit; font: inherit; font-size: 0.72rem; cursor: pointer; }
.d-steps button b { display: block; font-size: 1rem; }
.d-steps button.on { background: #0f4c5c; color: #fff; border-color: #0f4c5c; }
.d-muted { color: var(--muted, #666); font-size: 0.88rem; margin: 6px 0; }
.d-err { color: #b3261e; font-weight: 700; }
.d-list { list-style: none; padding: 0; margin: 12px 0; display: grid; gap: 8px; }
.d-list button { width: 100%; text-align: left; padding: 12px; border: 1px solid var(--line, #ccc); border-radius: 12px; background: var(--card, #fff); color: inherit; font: inherit; display: grid; gap: 4px; cursor: pointer; }
.d-tag { justify-self: start; font-size: 0.75rem; font-weight: 800; padding: 2px 8px; border-radius: 99px; background: #e4ecef; color: #0f4c5c; }
.d-tag.warn { background: #fbe9c8; color: #7a4b00; }
.d-tag.ok { background: #d3efdc; color: #14633a; }
.d-file { display: block; text-align: center; padding: 14px; border: 2px dashed var(--line, #aaa); border-radius: 12px; cursor: pointer; position: relative; }
.d-file input { position: absolute; inset: 0; opacity: 0; width: 100%; height: 100%; cursor: pointer; }
.d-check { display: flex !important; gap: 10px; align-items: center; font-weight: 600 !important; }
.d-check input { width: 22px; height: 22px; }
.d-photo { width: 100%; border-radius: 10px; margin-bottom: 8px; }
.d-chip { background: var(--card, #f1f1f1); border: 1px solid var(--line, #ddd); border-radius: 10px; padding: 8px 10px; font-size: 0.9rem; word-break: break-word; }
.d-prog { position: relative; height: 26px; border-radius: 8px; background: #dfe7ea; overflow: hidden; margin: 8px 0; }
.d-prog div { position: absolute; inset: 0 auto 0 0; background: #6aa9b8; transition: width .2s; }
.d-prog span { position: relative; font-size: 0.78rem; line-height: 26px; padding: 0 8px; }
.d-how { padding-left: 20px; line-height: 1.55; }
.desk pre { white-space: pre-wrap; word-break: break-word; background: var(--card, #f5f5f5); padding: 10px; border-radius: 8px; font-size: 0.82rem; }
.d-banner { padding: 12px; border-radius: 10px; font-weight: 800; color: #fff; margin: 8px 0; }
.d-banner.red { background: #b3261e; } .d-banner.amber { background: #e6a014; color: #000; } .d-banner.green { background: #1e8240; }
.d-warn { list-style: none; padding: 0; display: grid; gap: 6px; }
.d-warn li { border-left: 5px solid; border-radius: 6px; padding: 8px 10px; background: var(--card, #f7f7f7); }
.d-warn li.red { border-color: #b3261e; } .d-warn li.amber { border-color: #e6a014; }
.d-warn summary { cursor: pointer; } .d-warn p { white-space: pre-wrap; font-size: 0.88rem; margin: 8px 0 2px; }
.d-status { position: sticky; bottom: 8px; background: #102a32; color: #fff; padding: 12px; border-radius: 10px; margin-top: 14px; }
.d-del { margin-top: 28px; background: none; border: 1px solid #b3261e; color: #b3261e; padding: 10px; border-radius: 10px; font: inherit; width: 100%; cursor: pointer; }
`;
