"use client";
// "Phone check": tests each part of the News desk on the device that opens it, one line each (✓ works, ✗ fails + why).
// Made because the iPhone cannot be tested from a PC. Nothing is saved on the website and no clip is uploaded.
import { useEffect, useRef, useState } from "react";
import { listDeskItems } from "../actions.js";
import { loadLame, makeMp3, describe } from "../audio.js";

// A short test tone as a WAV file (16 kHz, mono, 16 bit), so the sound system can be tested without any clip.
function toneWav(seconds = 0.4, rate = 16000) {
  const n = Math.floor(seconds * rate);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin((2 * Math.PI * 440 * i) / rate) * 12000), true);
  return buf;
}

export default function PhoneCheck() {
  const [lines, setLines] = useState([]);
  const [running, setRunning] = useState(false);
  const ran = useRef(false);
  const add = (ok, text) => setLines((l) => [...l, { ok, text }]);

  async function runAll() {
    setRunning(true);
    setLines([]);
    const ua = navigator.userAgent;
    add(null, `Phone: ${ua}`);
    add(null, `Opened as ${navigator.standalone || window.matchMedia?.("(display-mode: standalone)").matches ? "a home-screen app" : "a normal web page"}; ${navigator.onLine ? "online" : "OFFLINE"}; page time ${new Date().toLocaleString()}.`);
    // 1. sign-in and the website's save functions
    try {
      const items = await listDeskItems();
      add(true, `Signed in, and the website's save functions answer (${items.length} items).`);
    } catch (e) {
      const old = /server action|Failed to find|not found/i.test(String(e?.message));
      add(false, `The website's save functions did not answer: ${describe(e)}.${old ? " This page is from an older version of the site: close the app completely (swipe it away), open it again, then run this check again." : " Check the connection and that you are signed in."}`);
    }
    // 2. the MP3 encoder file
    try {
      const lame = await loadLame();
      add(true, `MP3 encoder loaded (${typeof lame.Mp3Encoder}).`);
    } catch (e) {
      add(false, `MP3 encoder: ${describe(e)}`);
    }
    // 3. the sound system
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      add(false, "This browser has no Web Audio system, so the phone cannot make the MP3. Use Safari, or send the video straight to the Gemini app.");
    } else {
      let ctx;
      try {
        ctx = new Ctx();
        add(true, `Sound system opened (state: ${ctx.state}, ${ctx.sampleRate} Hz).`);
      } catch (e) {
        add(false, `Sound system: ${describe(e)}`);
      }
      if (ctx) {
        try {
          const dec = await new Promise((resolve, reject) => {
            const t = setTimeout(() => reject(new Error("no answer in 10 s")), 10000);
            ctx.decodeAudioData(toneWav(), (b) => { clearTimeout(t); resolve(b); }, (e) => { clearTimeout(t); reject(e || new Error("decode refused")); });
          });
          add(true, `Reading sound from a file works (${dec.duration.toFixed(2)} s test tone).`);
        } catch (e) {
          add(false, `Reading sound from a file: ${describe(e)}`);
        }
        try { await ctx.close?.(); } catch {}
      }
      // 4. making the sound small (16 kHz)
      try {
        const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        const off = new Off(1, 6400, 16000);
        const src = off.createBufferSource();
        const b = off.createBuffer(1, 6400, 16000);
        for (let i = 0; i < 6400; i++) b.getChannelData(0)[i] = Math.sin(i / 10) * 0.5;
        src.buffer = b;
        src.connect(off.destination);
        src.start();
        const out = await off.startRendering();
        add(true, `Making the sound small (16 kHz) works (${out.length} samples).`);
      } catch (e) {
        add(false, `Making the sound small (16 kHz): ${describe(e)}`);
      }
    }
    // 5. the MP3 maker itself
    try {
      const lame = await loadLame();
      const enc = new lame.Mp3Encoder(1, 16000, 32);
      const pcm = new Int16Array(16000 * 0.4).map((_, i) => Math.sin(i / 10) * 8000);
      const parts = [enc.encodeBuffer(pcm), enc.flush()];
      const bytes = parts.reduce((n, p) => n + p.length, 0);
      add(bytes > 0, bytes > 0 ? `MP3 maker works (${bytes} bytes from a test tone).` : "MP3 maker made an empty file.");
    } catch (e) {
      add(false, `MP3 maker: ${describe(e)}`);
    }
    add(null, "Now choose a real video below to test the whole video-to-audio step (the clip stays on the phone).");
    setRunning(false);
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    runAll();
  }, []);

  async function testClip(file) {
    if (!file) return;
    setRunning(true);
    add(null, `Clip: ${file.name || "clip"}, ${(file.size / 1048576).toFixed(1)} MB, type ${file.type || "unknown"}.`);
    const t0 = Date.now();
    try {
      const r = await makeMp3(file, () => {}, (m) => add(null, `  ${m}`));
      add(true, `Video to audio WORKS: ${(r.bytes / 1024).toFixed(0)} KB, ${Math.round(r.seconds)} s, in ${((Date.now() - t0) / 1000).toFixed(1)} s (way: ${r.way}).`);
    } catch (e) {
      add(false, `Video to audio FAILED: ${e.message}`);
    }
    setRunning(false);
  }

  const report = lines.map((l) => `${l.ok === true ? "OK   " : l.ok === false ? "FAIL " : "     "}${l.text}`).join("\n");

  return (
    <div style={{ padding: 16, maxWidth: 680, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <p><a href="/admin/desk">← News desk</a></p>
      <h1 style={{ fontSize: "1.3rem" }}>Phone check</h1>
      <p style={{ color: "#555" }}>Tests each part of the News desk on this phone. Take a screenshot of the result and send it, or press Copy report.</p>
      <div style={{ display: "grid", gap: 6, margin: "12px 0" }}>
        {lines.map((l, i) => (
          <div key={i} style={{ padding: "8px 10px", borderRadius: 8, background: l.ok === true ? "#e6f4ea" : l.ok === false ? "#fce8e6" : "#f1f3f4", color: "#111", fontSize: "0.9rem", wordBreak: "break-word" }}>
            {l.ok === true ? "✓ " : l.ok === false ? "✗ " : ""}
            {l.text}
          </div>
        ))}
        {running && <div style={{ color: "#555" }}>Working...</div>}
      </div>
      <label style={{ display: "block", margin: "12px 0" }}>
        <span style={{ display: "block", marginBottom: 6 }}>Test a video or audio clip from this phone</span>
        <input type="file" accept="video/*,audio/*" disabled={running} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; testClip(f); }} />
      </label>
      <button type="button" disabled={running} onClick={runAll} style={{ padding: "10px 14px", marginRight: 8 }}>Run the checks again</button>
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(report); add(null, "Report copied."); } catch { add(null, "Could not copy. Select the text in the box below and copy it."); }
        }}
        style={{ padding: "10px 14px" }}
      >
        Copy report
      </button>
      <textarea readOnly value={report} rows={8} style={{ width: "100%", marginTop: 12, fontSize: "0.75rem" }} />
    </div>
  );
}
