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

const tick = () => new Promise((r) => setTimeout(r, 0));

// onProgress(0..1, "text"). Returns { blob, seconds, bytes }.
export async function makeMp3(file, onProgress = () => {}) {
  if (file.size > MAX_FILE) throw new Error("This file is very large (over 300 MB). Cut the clip shorter on the phone first.");
  onProgress(0.02, "Reading the clip...");
  const lame = await loadLame();
  const buf = await file.arrayBuffer();
  onProgress(0.15, "Taking the sound out of the video...");
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  let audio;
  try {
    audio = await new Promise((resolve, reject) => ctx.decodeAudioData(buf, resolve, reject));
  } catch {
    ctx.close?.();
    throw new Error("This phone could not read the sound of this file. Send the video straight to the Gemini app instead.");
  }
  ctx.close?.();
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
