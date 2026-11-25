"""Automated QC + take selection for ElevenLabs narration.
For each section: transcribe both takes back to Hindi (Whisper large-v3), score
against the script, check peak level, pick the better take, trim silence, and
locate sentence boundaries (longest pauses) for caption timing."""
import sys, os, json, re, subprocess, difflib
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from script_data import FULL, SHORT
from faster_whisper import WhisperModel
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
VO = os.path.join(ROOT, "03_VOICEOVER")
m = WhisperModel("large-v3", device="cpu", compute_type="int8", cpu_threads=4)

def norm(s):
    s = s.replace("़", "")
    s = re.sub(r"[।,.!?'\"\-–—:;()‘’“”]", " ", s)
    s = s.replace("ं", "ँ")
    return re.sub(r"\s+", " ", s).strip()

def load(f, sr=48000):
    b = subprocess.check_output(["ffmpeg", "-v", "error", "-i", f, "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"])
    return np.frombuffer(b, np.float32)

def silences(a, sr, thr_db=-40, min_d=0.12):
    win = int(sr * 0.01)
    n = len(a) // win
    e = 20 * np.log10(np.sqrt(np.mean(a[:n * win].reshape(n, win) ** 2, 1)) + 1e-9)
    quiet = e < thr_db
    out, i = [], 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if (j - i) * 0.01 >= min_d:
                out.append((i * 0.01, j * 0.01))
            i = j
        else:
            i += 1
    return out

ONLY = sys.argv[1:]
rp = os.path.join(VO, "narration_qc.json")
report = json.load(open(rp)) if ONLY and os.path.exists(rp) else {}
for group, data, sub in [("full", FULL, "full_documentary"), ("short", SHORT, "short_horizontal")]:
    for sec, sents in data.items():
        if ONLY and sec not in ONLY:
            continue
        ref = norm(" ".join(h for h, _ in sents))
        best = None
        for tk in "ab":
            f = os.path.join(VO, sub, "takes", f"{sec}{tk}.mp3")
            a16 = load(f, 16000)
            segs, _ = m.transcribe(a16, language="hi", beam_size=5, condition_on_previous_text=False)
            hyp = norm(" ".join(s.text for s in segs))
            score = difflib.SequenceMatcher(None, ref, hyp).ratio()
            a = load(f)
            peak = float(20 * np.log10(np.max(np.abs(a)) + 1e-9))
            sil = silences(a, 48000)
            inner = [s for s in sil if s[0] > 0.05 and s[1] < len(a) / 48000 - 0.05]
            longest_gap = max([e - s for s, e in inner], default=0)
            r = dict(take=tk, score=round(score, 3), peak_db=round(peak, 1), longest_gap=round(longest_gap, 2), asr=hyp)
            print(sec, r, flush=True)
            # prefer accuracy; penalise unnatural long gaps (>1.2 s) and clipping
            q = score - (0.05 if longest_gap > 1.2 else 0) - (0.05 if peak > -0.3 else 0)
            if best is None or q > best[0]:
                best = (q, tk, f, a, sil, r)
        q, tk, f, a, sil, r = best
        dur = len(a) / 48000
        lead = sil[0][1] if sil and sil[0][0] <= 0.01 else 0.0
        tail = sil[-1][0] if sil and sil[-1][1] >= dur - 0.02 else dur
        s0, s1 = max(0, lead - 0.05), min(dur, tail + 0.12)
        clip = a[int(s0 * 48000):int(s1 * 48000)]
        fade = int(0.01 * 48000)
        clip = clip.copy(); clip[:fade] *= np.linspace(0, 1, fade); clip[-fade:] *= np.linspace(1, 0, fade)
        out = os.path.join(VO, sub, f"{sec}.wav")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", "48000", "-ac", "1", "-i", "-", "-c:a", "pcm_s24le", out], input=clip.tobytes(), check=True)
        # sentence boundaries: the (k-1) longest inner pauses, in time order
        k = len(sents)
        inner = [(s - s0, e - s0) for s, e in sil if s > s0 + 0.2 and e < s1 - 0.2]
        cuts = sorted(sorted(inner, key=lambda x: x[1] - x[0], reverse=True)[:k - 1])
        bounds = [0.0] + [(s + e) / 2 for s, e in cuts] + [len(clip) / 48000]
        report[sec] = dict(chosen=tk, file=os.path.relpath(out, ROOT), duration=round(len(clip) / 48000, 3),
                           sentence_bounds=[round(b, 3) for b in bounds], qc=r)
json.dump(report, open(os.path.join(VO, "narration_qc.json"), "w"), ensure_ascii=False, indent=1)
print("DONE")
