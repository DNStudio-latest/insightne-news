"""Shared rendering helpers for the Soumee Sailesh documentary.

Everything is drawn with Pillow + numpy and piped to FFmpeg, so the
edit is reproducible from source with no proprietary software.
"""
import math, os, subprocess, functools
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "01_SOURCE_MEDIA")
FPS = 25

# ---- Visual identity -------------------------------------------------------
NAVY = (8, 20, 48)
NAVY2 = (14, 34, 78)
BLUE = (30, 70, 150)
GOLD = (212, 175, 96)
GOLD_L = (236, 210, 150)
WHITE = (255, 255, 255)
OFFWHITE = (236, 238, 244)
RED = (200, 38, 48)
GREY = (150, 160, 180)

F_DIR = "/usr/share/fonts/opentype/inter/"
SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"


@functools.lru_cache(maxsize=256)
def font(size, weight="Bold", display=True):
    name = ("InterDisplay-" if display else "Inter-") + weight + ".otf"
    return ImageFont.truetype(F_DIR + name, int(size))


@functools.lru_cache(maxsize=64)
def serif(size):
    return ImageFont.truetype(SERIF, int(size))


# ---- Easing ----------------------------------------------------------------
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out(x):
    x = clamp(x)
    return 1 - (1 - x) ** 3


def ease_in_out(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def prog(t, start, dur):
    """0..1 progress of an animation that starts at `start` and lasts `dur`."""
    return clamp((t - start) / dur) if dur > 0 else float(t >= start)


def fade_io(t, total, fin=0.5, fout=0.5):
    a = 1.0
    if fin > 0:
        a = min(a, clamp(t / fin))
    if fout > 0:
        a = min(a, clamp((total - t) / fout))
    return a


# ---- Text ------------------------------------------------------------------
def text_size(txt, f, tracking=0):
    b = f.getbbox(txt)
    w = b[2] - b[0] + tracking * max(0, len(txt) - 1)
    return w, b[3] - b[1]


def draw_text(img, xy, txt, f, fill=WHITE, alpha=1.0, anchor="la", tracking=0,
              shadow=True, shadow_alpha=0.55, shadow_r=6):
    """Draw text onto an RGBA image with optional soft shadow and letter spacing."""
    if alpha <= 0 or not txt:
        return
    x, y = xy
    w, h = text_size(txt, f, tracking)
    # resolve anchor horizontally ourselves when tracking is used
    if tracking:
        if anchor[0] == "m":
            x -= w / 2
        elif anchor[0] == "r":
            x -= w
        anchor = "l" + anchor[1]
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    def _put(dd, ox, oy, col):
        if tracking:
            cx = x + ox
            for ch in txt:
                dd.text((cx, y + oy), ch, font=f, fill=col, anchor=anchor)
                cx += f.getlength(ch) + tracking
        else:
            dd.text((x + ox, y + oy), txt, font=f, fill=col, anchor=anchor)

    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        _put(ImageDraw.Draw(sh), 0, 3, (0, 0, 0, int(255 * shadow_alpha * alpha)))
        sh = sh.filter(ImageFilter.GaussianBlur(shadow_r))
        img.alpha_composite(sh)
    _put(d, 0, 0, fill[:3] + (int(255 * alpha),))
    img.alpha_composite(layer)


def wrap(txt, f, maxw):
    words, lines, cur = txt.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if f.getlength(t) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ---- Images ----------------------------------------------------------------
def load_rgb(path):
    return Image.open(path).convert("RGB")


def cover(img, W, H, cx=0.5, cy=0.5):
    """Scale+crop to fill W x H."""
    s = max(W / img.width, H / img.height)
    im = img.resize((math.ceil(img.width * s), math.ceil(img.height * s)), Image.LANCZOS)
    x = int((im.width - W) * cx)
    y = int((im.height - H) * cy)
    return im.crop((x, y, x + W, y + H))


def kenburns(img, W, H, t, z0=1.0, z1=1.12, c0=(0.5, 0.5), c1=(0.5, 0.5)):
    """Smooth sub-pixel Ken Burns move. c are focus points (0..1) in source image."""
    e = ease_in_out(t)
    z = z0 + (z1 - z0) * e
    cx = c0[0] + (c1[0] - c0[0]) * e
    cy = c0[1] + (c1[1] - c0[1]) * e
    base = max(W / img.width, H / img.height)
    s = base * z
    vw, vh = W / s, H / s  # visible window in source px
    x0 = clamp(cx * img.width - vw / 2, 0, img.width - vw)
    y0 = clamp(cy * img.height - vh / 2, 0, img.height - vh)
    return img.transform((W, H), Image.AFFINE, (1 / s, 0, x0, 0, 1 / s, y0), resample=Image.BICUBIC)


def blurred_bg(img, W, H, radius=40, dark=0.45):
    bg = cover(img, W // 4, H // 4).filter(ImageFilter.GaussianBlur(radius / 4))
    bg = bg.resize((W, H), Image.BILINEAR)
    return Image.blend(bg, Image.new("RGB", (W, H), (0, 0, 0)), dark)


def vignette(W, H, strength=0.55):
    y, x = np.ogrid[0:H, 0:W]
    d = np.sqrt(((x - W / 2) / (W / 2)) ** 2 + ((y - H / 2) / (H / 2)) ** 2) / math.sqrt(2)
    a = np.clip((d - 0.35) / 0.65, 0, 1) ** 1.6 * strength
    m = np.zeros((H, W, 4), np.uint8)
    m[..., 3] = (a * 255).astype(np.uint8)
    return Image.fromarray(m, "RGBA")


def grad_rect(W, H, c0, c1, vertical=True, a0=255, a1=255):
    n = H if vertical else W
    t = np.linspace(0, 1, n)[:, None]
    col = np.array(c0)[None] * (1 - t) + np.array(c1)[None] * t
    al = a0 * (1 - t) + a1 * t
    row = np.concatenate([col, al], 1).astype(np.uint8)
    if vertical:
        arr = np.repeat(row[:, None, :], W, 1)
    else:
        arr = np.repeat(row[None, :, :], H, 0)
    return Image.fromarray(arr, "RGBA")


@functools.lru_cache(maxsize=8)
def bg_navy(W, H):
    """Deep blue broadcast background with soft light falloff."""
    y, x = np.ogrid[0:H, 0:W]
    d = np.sqrt(((x - W * 0.5) / W) ** 2 + ((y - H * 0.42) / H) ** 2)
    k = np.clip(1 - d * 1.5, 0, 1)[..., None]
    c0 = np.array(NAVY, float)
    c1 = np.array((22, 52, 112), float)
    arr = c0 * (1 - k) + c1 * k
    return Image.fromarray(arr.astype(np.uint8), "RGB")


# ---- Video I/O -------------------------------------------------------------
class Writer:
    def __init__(self, path, W, H, fps=FPS, crf=14):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.p = subprocess.Popen([
            "ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-s", f"{W}x{H}", "-r", str(fps), "-i", "-", "-c:v", "libx264",
            "-preset", "fast", "-crf", str(crf), "-pix_fmt", "yuv420p", path],
            stdin=subprocess.PIPE)
        self.W, self.H = W, H

    def write(self, img):
        if img.mode != "RGB":
            img = img.convert("RGB")
        self.p.stdin.write(img.tobytes())

    def close(self):
        self.p.stdin.close()
        self.p.wait()


class Reader:
    """Sequential frame reader at FPS from `start` seconds, with optional ffmpeg filter."""
    def __init__(self, path, start=0.0, vf=None, size=None):
        if size is None:
            out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0",
                                           "-show_entries", "stream=width,height", "-of", "csv=p=0", path]).decode()
            size = tuple(int(v) for v in out.strip().split(","))
        self.W, self.H = size
        f = f"fps={FPS}" + ("," + vf if vf else "")
        self.p = subprocess.Popen(["ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-i", path, "-vf", f,
                                   "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
        self.last = None

    def next(self):
        n = self.W * self.H * 3
        b = self.p.stdout.read(n)
        if len(b) == n:
            self.last = Image.frombytes("RGB", (self.W, self.H), b)
        return self.last

    def close(self):
        self.p.kill()


# ---- Broadcast elements ----------------------------------------------------
def lower_third(img, t, name, role, W=1920, H=1080, dur=5.0, y=None):
    """Clean broadcast lower-third: gold bar wipes in, name and role slide up."""
    if t < 0 or t > dur:
        return
    s = W / 1920
    a_in = ease_out(prog(t, 0, 0.6))
    a_out = 1 - ease_out(prog(t, dur - 0.5, 0.5))
    a = min(a_in, a_out)
    x0 = int(110 * s)
    y0 = int((y if y is not None else 820) * s)
    fn, fr = font(52 * s, "Bold"), font(30 * s, "Medium", False)
    wn = max(fn.getlength(name), fr.getlength(role)) + 80 * s
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    bw = int(wn * ease_out(prog(t, 0.1, 0.6)) * a_out + 0.5)
    d.rectangle([x0, y0, x0 + bw, y0 + int(76 * s)], fill=NAVY + (int(225 * a),))
    rw = int(max(wn * 0.8, fr.getlength(role) + 60 * s) * ease_out(prog(t, 0.1, 0.6)) * a_out)
    d.rectangle([x0, y0 + int(76 * s), x0 + rw, y0 + int(118 * s)], fill=(255, 255, 255, int(235 * a)))
    d.rectangle([x0 - int(10 * s), y0, x0 - int(2 * s), y0 + int(118 * s)], fill=GOLD + (int(255 * a),))
    img.alpha_composite(layer)
    off = (1 - ease_out(prog(t, 0.25, 0.5))) * 20 * s
    draw_text(img, (x0 + 28 * s, y0 + 38 * s + off), name, fn, WHITE, a * ease_out(prog(t, 0.25, 0.4)), anchor="lm", shadow=False)
    draw_text(img, (x0 + 28 * s, y0 + 97 * s + off), role, fr, NAVY, a * ease_out(prog(t, 0.4, 0.4)), anchor="lm", shadow=False)


def bug(img, W, H, alpha=1.0):
    """Small InsightNE channel bug, top-right."""
    s = W / 1920 if W > H else H / 1920 * 0.9
    f1 = font(30 * s, "Black")
    x = W - int(60 * s)
    y = int(56 * s)
    w1 = f1.getlength("INSIGHT")
    w2 = f1.getlength("NE")
    pad = 12 * s
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle([x - w1 - w2 - 2 * pad, y - 22 * s, x, y + 22 * s], radius=6 * s,
                        fill=(8, 20, 48, int(170 * alpha)))
    img.alpha_composite(lay)
    draw_text(img, (x - w2 - pad - w1, y), "INSIGHT", f1, WHITE, alpha * 0.95, anchor="lm", shadow=False)
    draw_text(img, (x - w2 - pad, y), "NE", f1, GOLD, alpha * 0.95, anchor="lm", shadow=False)


def label_tag(img, txt, W, H, alpha=1.0, pos="tl"):
    """Small honesty tag, e.g. 'FILE: OFFICIAL SONG VIDEO' or 'GRAPHIC'."""
    s = W / 1920 if W > H else 1.0
    f = font(20 * s, "SemiBold", False)
    w = f.getlength(txt) + 24 * s
    x = int(60 * s) if pos == "tl" else W - int(60 * s) - w
    y = int(40 * s) if pos == "tl" else H - int(80 * s)
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).rectangle([x, y, x + w, y + 34 * s], fill=(0, 0, 0, int(140 * alpha)))
    img.alpha_composite(lay)
    draw_text(img, (x + 12 * s, y + 17 * s), txt, f, (230, 230, 230), alpha, anchor="lm", shadow=False)


def waveform(img, cx, cy, width, height, t, bars=64, color=GOLD, alpha=1.0, seed=3, amp=1.0):
    """Animated, symmetrical audio-waveform decoration."""
    rng = np.random.RandomState(seed)
    ph = rng.rand(bars) * 6.28
    fr = 1.5 + rng.rand(bars) * 2.5
    env = np.hanning(bars + 2)[1:-1] ** 0.7
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    bw = width / bars
    for i in range(bars):
        v = (0.25 + 0.75 * abs(math.sin(t * fr[i] + ph[i]))) * env[i] * amp
        h = max(2, v * height / 2)
        x = cx - width / 2 + i * bw
        d.rounded_rectangle([x + bw * 0.2, cy - h, x + bw * 0.8, cy + h], radius=bw * 0.3,
                            fill=color + (int(255 * alpha),))
    img.alpha_composite(lay)
