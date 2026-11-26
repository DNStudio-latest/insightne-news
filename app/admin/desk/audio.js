// Turns a video (or audio) file into a small MP3 on the phone, so only sound goes to Gemini (saves mobile data).
// Mono, 16 kHz, 32 kbps: about 0.25 MB per minute. Nothing is uploaded to the website: the file stays on the phone.
// The MP3 encoder (public/desk/lame.min.js, lamejs 1.2.1) is loaded only when needed.
// When something fails, the message says WHICH step failed and why, so it can be fixed (an iPhone cannot be tested from a PC).

const MAX_FILE = 300 * 1024 * 1024;

export function loadLame() {
  if (typeof window !== "undefined" && window.lamejs?.Mp3Encoder) return Promise.resolve(window.lamejs);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "/desk/lame.min.js";
    s.onload = () => (window.lamejs?.Mp3Encoder ? resolve(window.lamejs) : reject(new Error("The audio encoder did not load.")));
    s.onerror = () => reject(new Error("The audio encoder could not be loaded. Check the connection."));
    document.head.appendChild(s);
  });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// "EncodingError: Unable to decode audio data", or just the message.
export const describe = (e) => [e?.name && e.name !== "Error" ? e.name : "", e?.message || String(e || "")].filter(Boolean).join(": ");

// Plays the file in a hidden video element, sends its sound into a silent recorder and returns an AudioBuffer.
async function recordFromPlayback(file, Ctx, onProgress, trace) {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.preload = "auto";
  video.muted = true; // lets the phone start playing without a fresh tap; un-muted once it runs (its sound goes only to the silent recorder)
  video.style.display = "none";
  document.body.appendChild(video);
  const ctx = new Ctx();
  const chunks = [];
  let node = null;
  try {
    await withTimeout(
      new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = () => reject(new Error("The phone cannot play this video."));
      }),
      30000
    );
    const total = video.duration && isFinite(video.duration) ? video.duration : 0;
    trace(`Playback: the phone opened the clip (${total ? Math.round(total) + " s" : "length unknown"}).`);
    if (ctx.state === "suspended") await withTimeout(ctx.resume(), 5000).catch(() => trace("Playback: the sound system would not wake up (it stays asleep until a tap)."));
    let source;
    try {
      source = ctx.createMediaElementSource(video);
    } catch (e) {
      throw new Error(`The phone would not let the page listen to the clip's sound (${describe(e)}).`);
    }
    node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    // Waits until the clip ends. If it stops moving for 6 seconds (the iPhone pauses it when it is un-muted or the screen locks),
    // or it takes far longer than the clip itself, it gives up with a clear message instead of waiting for ever.
    const done = new Promise((resolve, reject) => {
      const started = Date.now();
      const limit = ((total || 120) * 2 + 20) * 1000;
      let lastTime = -1;
      let lastMove = Date.now();
      const watch = setInterval(() => {
        if (total) onProgress(0.1 + 0.25 * Math.min(1, video.currentTime / total), `Taking the sound... ${Math.round(video.currentTime)} of ${Math.round(total)} s`);
        if (video.ended) { clearInterval(watch); resolve(); return; }
        if (video.currentTime !== lastTime) { lastTime = video.currentTime; lastMove = Date.now(); }
        if (Date.now() - lastMove > 6000) { clearInterval(watch); reject(new Error(`The phone stopped playing the clip at ${Math.round(video.currentTime)} s. Keep the screen on and try again, or send the video straight to the Gemini app.`)); }
        else if (Date.now() - started > limit) { clearInterval(watch); reject(new Error("Taking the sound is much slower than the clip itself. Try again with the screen on, or send the video straight to the Gemini app.")); }
      }, 500);
      video.addEventListener("ended", () => { clearInterval(watch); resolve(); });
    });
    done.catch(() => {}); // the error is reported where it is awaited below
    await video.play();
    try { video.muted = false; } catch {}
    if (video.paused && !video.ended) {
      trace("Playback: the phone paused the clip when the sound was switched on; starting it again.");
      try { await video.play(); } catch (e) { trace(`Playback: could not restart (${describe(e)}).`); }
    }
    await done;
    const len = chunks.reduce((n, c) => n + c.length, 0);
    if (!len) throw new Error("This phone could not take the sound from this video. Send the video straight to the Gemini app instead.");
    trace(`Playback: recorded ${(len / ctx.sampleRate).toFixed(1)} s of sound.`);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buffer.getChannelData(0);
    let o = 0;
    for (const c of chunks) { ch.set(c, o); o += c.length; }
    return buffer;
  } catch (e) {
    if (e && e.name === "NotAllowedError") throw new Error("The phone blocked playing the clip. Choose the clip again and keep the screen on.");
    throw e;
  } finally {
    if (node) node.onaudioprocess = null;
    try { video.pause(); } catch {}
    video.remove();
    URL.revokeObjectURL(url);
    ctx.close?.();
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0));

// onProgress(0..1, "text"); trace("what happened") is optional and is used by the Phone check page.
// Returns { blob, seconds, bytes, way }. way is "direct" (sound read straight from the file) or "playback".
export async function makeMp3(file, onProgress = () => {}, trace = () => {}) {
  if (file.size > MAX_FILE) throw new Error("This file is very large (over 300 MB). Cut the clip shorter on the phone first.");
  onProgress(0.02, "Reading the clip...");
  const lame = await loadLame();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error("This browser has no audio system the page can use. Open the desk in Safari, or send the video straight to the Gemini app.");
  let audio = null;
  let way = "direct";
  let quickReason = "";
  const t0 = Date.now();
  // 1) quick way: decode the file's sound directly (works for most files, fails or hangs on some iPhone videos)
  try {
    const buf = await file.arrayBuffer();
    onProgress(0.15, "Taking the sound out of the video...");
    const ctx = new Ctx();
    try {
      audio = await withTimeout(new Promise((resolve, reject) => ctx.decodeAudioData(buf, resolve, reject)), 25000);
    } finally {
      ctx.close?.();
    }
    trace(`Direct way worked: ${audio.duration.toFixed(1)} s of sound in ${Date.now() - t0} ms.`);
  } catch (e) {
    quickReason = describe(e) || "unknown";
    trace(`Direct way failed after ${Date.now() - t0} ms: ${quickReason}`);
    audio = null;
  }
  // 2) fallback that works for any video the phone can play: play it silently and record its sound
  if (!audio) {
    way = "playback";
    onProgress(0.1, "The quick way did not work. Playing the clip silently to take its sound (takes as long as the clip)...");
    try {
      audio = await recordFromPlayback(file, Ctx, onProgress, trace);
    } catch (e) {
      throw new Error(`${e.message} [direct way: ${quickReason}]`);
    }
  }
  onProgress(0.35, "Making it small (mono, 16 kHz)...");
  const rate = 16000;
  let pcm;
  try {
    const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * rate)), rate);
    const src = off.createBufferSource();
    src.buffer = audio;
    src.connect(off.destination);
    src.start();
    const rendered = await off.startRendering();
    pcm = rendered.getChannelData(0);
  } catch (e) {
    throw new Error(`The sound was taken, but this phone could not make it small (${describe(e)}).`);
  }
  // A recording of pure silence would send Gemini an empty file without anyone noticing.
  let peak = 0;
  for (let i = 0; i < pcm.length; i += 7) peak = Math.max(peak, Math.abs(pcm[i]));
  if (peak < 0.00001) throw new Error(`The sound came out completely silent${way === "playback" ? " (the iPhone may have muted the recording)" : ""}. Send the video straight to the Gemini app instead.`);
  const enc = new lame.Mp3Encoder(1, rate, 32);
  const parts = [];
  const block = 1152 * 20;
  for (let i = 0; i < pcm.length; i += block) {
    const end = Math.min(pcm.length, i + block);
    const chunk = new Int16Array(end - i);
    for (let j = i; j < end; j++) {
      const v = Math.max(-1, Math.min(1, pcm[j]));
      chunk[j - i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const out = enc.encodeBuffer(chunk);
    if (out.length) parts.push(new Uint8Array(out));
    if (((i / block) | 0) % 10 === 0) {
      onProgress(0.4 + 0.58 * (i / pcm.length), "Encoding the audio...");
      await tick();
    }
  }
  const tail = enc.flush();
  if (tail.length) parts.push(new Uint8Array(tail));
  const blob = new Blob(parts, { type: "audio/mpeg" });
  onProgress(1, "Audio is ready.");
  return { blob, seconds: audio.duration, bytes: blob.size, way };
}
