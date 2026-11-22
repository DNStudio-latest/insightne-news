// Turns a video (or audio) file into a small MP3 on the phone, so only sound goes to Gemini (saves mobile data).
// Mono, 16 kHz, 32 kbps: about 0.25 MB per minute. Nothing is uploaded to the website: the file stays on the phone.
// The MP3 encoder (public/desk/lame.min.js, lamejs 1.2.1) is loaded only when needed.

const MAX_FILE = 300 * 1024 * 1024;

function loadLame() {
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

// Plays the file in a hidden video element, sends its sound into a silent recorder and returns an AudioBuffer.
async function recordFromPlayback(file, Ctx, onProgress) {
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
    if (ctx.state === "suspended") await ctx.resume();
    const source = ctx.createMediaElementSource(video);
    node = ctx.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => {
      chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(ctx.destination);
    const done = new Promise((resolve) => {
      const watch = setInterval(() => {
        if (total) onProgress(0.1 + 0.25 * Math.min(1, video.currentTime / total), `Taking the sound... ${Math.round(video.currentTime)} of ${Math.round(total)} s`);
        if (video.ended) { clearInterval(watch); resolve(); }
      }, 500);
      video.addEventListener("ended", () => { clearInterval(watch); resolve(); });
    });
    await video.play();
    video.muted = false;
    await done;
    const len = chunks.reduce((n, c) => n + c.length, 0);
    if (!len) throw new Error("This phone could not take the sound from this video. Send the video straight to the Gemini app instead.");
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

// onProgress(0..1, "text"). Returns { blob, seconds, bytes }.
export async function makeMp3(file, onProgress = () => {}) {
  if (file.size > MAX_FILE) throw new Error("This file is very large (over 300 MB). Cut the clip shorter on the phone first.");
  onProgress(0.02, "Reading the clip...");
  const lame = await loadLame();
  const Ctx = window.AudioContext || window.webkitAudioContext;
  let audio = null;
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
  } catch {
    audio = null;
  }
  // 2) fallback that works for any video the phone can play: play it silently and record its sound
  if (!audio) {
    onProgress(0.1, "The quick way did not work. Playing the clip silently to take its sound (takes as long as the clip)...");
    audio = await recordFromPlayback(file, Ctx, onProgress);
  }
  onProgress(0.35, "Making it small (mono, 16 kHz)...");
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.max(1, Math.ceil(audio.duration * rate)), rate);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const pcm = rendered.getChannelData(0);
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
  return { blob, seconds: audio.duration, bytes: blob.size };
}
