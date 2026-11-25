"""Scene types for the documentary. Each scene renders frame(t) -> RGB PIL image."""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from lib import *

INTERVIEW = os.path.join(SRC, "INTERVIEW", "interview_selfie_vertical.mov")
OFFICIAL = os.path.join(SRC, "FILM_CLIPS", "madirapan_official_song_excerpt_16x9.mov")
PROMO = os.path.join(SRC, "FILM_CLIPS", "madirapan_promo_vertical.mov")
PH = {
    "mic": os.path.join(SRC, "PHOTOGRAPHS", "photo1_microphone_black_dress.jpg"),
    "red": os.path.join(SRC, "PHOTOGRAPHS", "photo2_red_top_studio.jpg"),
    "jacket": os.path.join(SRC, "PHOTOGRAPHS", "photo3_leather_jacket.jpg"),
}
MAPS = os.path.join(ROOT, "04_GRAPHICS", "MAP_ANIMATION")


def grade(img, warm=0.0, contrast=1.04, sat=1.0):
    """Gentle, consistent grade: slight contrast and warmth, natural skin tones."""
    a = np.asarray(img).astype(np.float32)
    a = (a - 128) * contrast + 128
    if warm:
        a[..., 0] *= 1 + warm
        a[..., 2] *= 1 - warm
    if sat != 1.0:
        g = a.mean(2, keepdims=True)
        a = g + (a - g) * sat
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def fast_blur_bg(frame, W, H, dark=0.5):
    small = cover(frame, max(8, W // 12), max(8, H // 12)).filter(ImageFilter.GaussianBlur(3))
    bg = small.resize((W, H), Image.BILINEAR)
    return Image.blend(bg, Image.new("RGB", (W, H), (0, 0, 0)), dark)


class Scene:
    dur = 3.0
    vertical = False
    fin = 0.0      # fade from black
    fout = 0.0     # fade to black
    bug = True
    overlays = ()  # callables (img, t, scene)

    def __init__(self, dur, W=1920, H=1080, **kw):
        self.dur, self.W, self.H = dur, W, H
        self.vertical = H > W
        for k, v in kw.items():
            setattr(self, k, v)

    def base(self, t):
        return Image.new("RGBA", (self.W, self.H), NAVY + (255,))

    def frame(self, t):
        img = self.base(t)
        if img.mode != "RGBA":
            img = img.convert("RGBA")
        for ov in self.overlays:
            ov(img, t, self)
        if getattr(self, "drift", False):
            # slow, continuous push-in so graphics never sit frozen
            z = 1.0 + 0.035 * clamp(t / max(self.dur, 0.01))
            W, H = self.W, self.H
            img = img.transform((W, H), Image.AFFINE, (1 / z, 0, W * (1 - 1 / z) / 2, 0, 1 / z, H * (1 - 1 / z) / 2), resample=Image.BICUBIC)
        if self.bug:
            bug(img, self.W, self.H, 0.9)
        a = 1.0
        if self.fin:
            a = min(a, clamp(t / self.fin))
        if self.fout:
            a = min(a, clamp((self.dur - t) / self.fout))
        if a < 1:
            img = Image.blend(Image.new("RGBA", img.size, (0, 0, 0, 255)), img, a)
        return img.convert("RGB")

    def close(self):
        pass


# ---------------------------------------------------------------------------
class PhotoScene(Scene):
    """Framed photo on its own blurred backdrop, with a slow push-in."""
    photo = "mic"
    layout = "framed"      # framed | full | left | right
    z0, z1 = 1.0, 1.06
    c0, c1 = (0.5, 0.45), (0.5, 0.42)
    warm = 0.02

    def setup(self):
        if not hasattr(self, "_img"):
            self._img = grade(load_rgb(PH[self.photo]), warm=self.warm)
            self._bg = blurred_bg(self._img, self.W, self.H, 50, 0.55)
            self._vig = vignette(self.W, self.H, 0.5)

    def base(self, t):
        self.setup()
        W, H, p = self.W, self.H, t / max(self.dur, 0.01)
        if self.layout == "full":
            img = kenburns(self._img, W, H, p, self.z0, self.z1, self.c0, self.c1).convert("RGBA")
            img.alpha_composite(self._vig)
            return img
        bg = self._bg.copy().convert("RGBA")
        # frame size: fit height (vertical: fit width)
        if self.vertical:
            fw = int(W * 0.86); fh = int(fw * 1.25)
        else:
            fh = int(H * 0.86)
            fw = int(fh * (self._img.width / self._img.height))
            fw = min(fw, int(W * 0.55))
        e = ease_in_out(p)
        z = self.z0 + (self.z1 - self.z0) * e
        cx = self.c0[0] + (self.c1[0] - self.c0[0]) * e
        cy = self.c0[1] + (self.c1[1] - self.c0[1]) * e
        inner = kenburns(self._img, fw, fh, p, z, z, (cx, cy), (cx, cy))
        if self.vertical:
            x = (W - fw) // 2; y = int(H * 0.16)
        elif self.layout == "left":
            x = int(W * 0.08); y = (H - fh) // 2
        elif self.layout == "right":
            x = int(W * 0.92) - fw; y = (H - fh) // 2
        else:
            x = (W - fw) // 2; y = (H - fh) // 2
        # drift
        x += int(12 * math.sin(p * 1.2))
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rectangle([x + 10, y + 18, x + fw + 10, y + fh + 18], fill=(0, 0, 0, 150))
        sh = sh.filter(ImageFilter.GaussianBlur(22))
        bg.alpha_composite(sh)
        bg.paste(inner, (x, y))
        d = ImageDraw.Draw(bg)
        d.rectangle([x, y, x + fw - 1, y + fh - 1], outline=GOLD + (120,), width=2)
        bg.alpha_composite(self._vig)
        self._frame_box = (x, y, fw, fh)
        return bg


# ---------------------------------------------------------------------------
class VideoScene(Scene):
    """Generic source-video scene; subclasses lay the frame out."""
    src = INTERVIEW
    start = 0.0
    vf = None

    def reader(self):
        if not hasattr(self, "_r"):
            self._r = Reader(self.src, self.start, self.vf)
        return self._r

    def close(self):
        if hasattr(self, "_r"):
            self._r.close()


class InterviewScene(VideoScene):
    """Her own interview (vertical selfie video) presented broadcast-style."""
    src = INTERVIEW
    side = "center"    # center | left | right

    def base(self, t):
        fr = grade(self.reader().next(), warm=0.0, contrast=1.03)
        W, H = self.W, self.H
        if self.vertical:
            img = fr.resize((W, int(W * fr.height / fr.width)), Image.LANCZOS)
            out = Image.new("RGB", (W, H), (0, 0, 0))
            out.paste(img, (0, (H - img.height) // 2))
            return out.convert("RGBA")
        bg = fast_blur_bg(fr, W, H, 0.55).convert("RGBA")
        h = H
        w = int(h * fr.width / fr.height)
        fg = fr.resize((w, h), Image.LANCZOS)
        x = {"center": (W - w) // 2, "left": int(W * 0.12), "right": int(W * 0.88) - w}[self.side]
        sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(sh).rectangle([x - 6, 0, x + w + 6, H], fill=(0, 0, 0, 170))
        bg.alpha_composite(sh.filter(ImageFilter.GaussianBlur(18)))
        bg.paste(fg, (x, 0))
        self._vid_box = (x, 0, w, h)
        return bg


class OfficialScene(VideoScene):
    """Official song video excerpt: full frame (ownership marks kept), letterboxed."""
    src = OFFICIAL
    label = "COURTESY: SALMAN KHAN FILMS MUSIC · OFFICIAL SONG VIDEO"

    def base(self, t):
        fr = self.reader().next()
        W, H = self.W, self.H
        if self.vertical and getattr(self, "vcrop", None):
            pic = fr.crop(self.vcrop)
            bg = fast_blur_bg(pic, W, H, 0.5).convert("RGBA")
            w = W; h = int(w * pic.height / pic.width)
            z = 1 + 0.04 * t / self.dur
            fg = pic.resize((int(w * z), int(h * z)), Image.LANCZOS)
            bg.paste(fg, ((W - fg.width) // 2, (H - fg.height) // 2 - 60))
            return bg
        if self.vertical:
            # centre crop of the picture area, no reframing of logos
            pic = fr.crop((0, 54, fr.width, 536))
            bg = fast_blur_bg(pic, W, H, 0.45).convert("RGBA")
            w = W
            h = int(w * fr.height / fr.width)
            fg = fr.resize((w, h), Image.LANCZOS)
            bg.paste(fg, (0, int(H * 0.30)))
            return bg
        w = W
        h = int(W * fr.height / fr.width)
        out = Image.new("RGBA", (W, H), (0, 0, 0, 255))
        out.paste(fr.resize((w, h), Image.LANCZOS), (0, (H - h) // 2))
        return out

    def frame(self, t):
        img = Scene.frame(self, t)
        return img


def courtesy(img, t, sc):
    label_tag(img.__class__ and img, sc.label, sc.W, sc.H, 0.9 * clamp(t / 0.4), pos="tl" if not sc.vertical else "tl")


class PromoScene(VideoScene):
    """Promotional vertical clip: either the film part or the poster part."""
    src = PROMO
    part = "poster"   # poster | film | full
    label = "COURTESY: MADIRAPAN PROMOTIONAL VIDEO"

    def base(self, t):
        fr = self.reader().next()
        W, H = self.W, self.H
        if self.part == "poster":
            pic = fr.crop((0, 780, 720, 1280))
        elif self.part == "film":
            pic = fr.crop((0, 0, 720, 780))
        else:
            pic = fr
        if self.vertical:
            if self.part == "full":
                return pic.resize((W, H), Image.LANCZOS).convert("RGBA")
            bg = fast_blur_bg(pic, W, H, 0.5).convert("RGBA")
            w = W
            h = int(w * pic.height / pic.width)
            bg.paste(pic.resize((w, h), Image.LANCZOS), (0, (H - h) // 2 - 80))
            return bg
        bg = fast_blur_bg(pic, W, H, 0.55).convert("RGBA")
        h = int(H * (0.9 if self.part == "poster" else 1.0))
        w = int(h * pic.width / pic.height)
        if w > W * 0.9:
            w = int(W * 0.9); h = int(w * pic.height / pic.width)
        z = 1 + 0.05 * (t / self.dur)
        w2, h2 = int(w * z), int(h * z)
        lift = 70 if self.part == "poster" else 0
        bg.paste(pic.resize((w2, h2), Image.LANCZOS), ((W - w2) // 2, (H - h2) // 2 - lift))
        return bg


class FileScene(VideoScene):
    """Plays a pre-rendered graphic (e.g. the map animation)."""
    def base(self, t):
        return self.reader().next().convert("RGBA")


# ---------------------------------------------------------------------------
# Graphic cards
class CardScene(Scene):
    """Navy broadcast card with optional framed photo; subclasses draw content."""
    photo = None
    drift = True
    photo_side = "right"

    def base(self, t):
        W, H = self.W, self.H
        img = bg_navy(W, H).copy().convert("RGBA")
        # subtle moving light streak
        lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(lay)
        x = (t * 60) % (W * 1.5) - W * 0.25
        for i in range(6):
            d.line([(x + i * 3, 0), (x - H * 0.6 + i * 3, H)], fill=(255, 255, 255, 6), width=60)
        # musical staff decoration
        y0 = H * (0.82 if not self.vertical else 0.88)
        for k in range(5):
            yy = y0 + k * 12 * (W / 1920 if not self.vertical else 1)
            d.line([(0, yy), (W, yy)], fill=(255, 255, 255, 12), width=2)
        img.alpha_composite(lay)
        if self.photo:
            if not hasattr(self, "_ph"):
                self._ph = grade(load_rgb(PH[self.photo]), warm=0.02)
            if self.vertical:
                fw = int(W * 0.62); fh = int(fw * 1.2)
                x = (W - fw) // 2; y = int(H * 0.12)
            else:
                fh = int(H * 0.74); fw = int(fh * 0.8)
                x = int(W * 0.93) - fw if self.photo_side == "right" else int(W * 0.07)
                y = (H - fh) // 2
            a = ease_out(prog(t, 0.1, 0.8))
            ph = kenburns(self._ph, fw, fh, t / self.dur, 1.02, 1.08, (0.5, 0.35), (0.5, 0.32))
            ph = Image.blend(Image.new("RGB", ph.size, NAVY), ph, a)
            img.paste(ph, (x, y + int((1 - a) * 30)))
            ImageDraw.Draw(img).rectangle([x, y + int((1 - a) * 30), x + fw - 1, y + fh - 1 + int((1 - a) * 30)], outline=GOLD + (int(160 * a),), width=2)
        self.draw(img, t)
        return img

    def draw(self, img, t):
        pass


def heading(img, x, y, txt, t, t0=0.0, size=64, color=WHITE, anchor="la", tracking=2, bar=True):
    a = ease_out(prog(t, t0, 0.6))
    off = (1 - a) * 24
    f = font(size, "Black")
    draw_text(img, (x, y + off), txt, f, color, a, anchor=anchor, tracking=tracking)
    if bar:
        w = text_size(txt, f, tracking)[0]
        bw = int(min(140, w) * ease_out(prog(t, t0 + 0.3, 0.6)))
        bx = x if anchor[0] == "l" else x - bw / 2
        ImageDraw.Draw(img).rectangle([bx, y + size * 1.25 + off, bx + bw, y + size * 1.25 + 6 + off], fill=GOLD + (int(255 * a),))


def bullet_rows(img, x, y, rows, t, t0, step=0.7, size=40, gap=86, maxw=900, sub=None):
    f = font(size, "SemiBold", False)
    for i, r in enumerate(rows):
        a = ease_out(prog(t, t0 + i * step, 0.5))
        if a <= 0:
            continue
        off = (1 - a) * 30
        d = ImageDraw.Draw(img)
        yy = y + i * gap
        d.ellipse([x + off, yy + size * 0.32, x + 16 + off, yy + size * 0.32 + 16], fill=GOLD + (int(255 * a),))
        draw_text(img, (x + 40 + off, yy), r, f, OFFWHITE, a, anchor="la")


class EducationCard(CardScene):
    photo = "jacket"

    def draw(self, img, t):
        s = 1.0
        heading(img, 120, 170, "HER MUSICAL FOUNDATION", t, 0.2, 62)
        rows = ["Chebri, Khowai, Tripura", "Early musical guidance from her mother",
                "Classical music training", "Bachelor of Music, S.D. Barman College"]
        bullet_rows(img, 120, 330, rows, t, 0.9, step=0.9, size=42, gap=92)
        waveform(img, 520, 850, 760, 70, t, bars=60, color=GOLD, alpha=0.55 * ease_out(prog(t, 0.5, 1)))


class DegreeCard(CardScene):
    photo = "mic"
    photo_side = "left"

    def draw(self, img, t):
        x = 860
        a = ease_out(prog(t, 0.2, 0.6))
        draw_text(img, (x, 250), "MUSICAL EDUCATION", font(34, "Bold"), GOLD_L, a, tracking=8)
        a2 = ease_out(prog(t, 0.6, 0.7))
        draw_text(img, (x, 320 + (1 - a2) * 20), "Bachelor of Music", font(96, "Black"), WHITE, a2)
        draw_text(img, (x, 440 + (1 - a2) * 20), "(B.Mus)", font(56, "Bold"), GOLD_L, a2)
        a3 = ease_out(prog(t, 1.2, 0.7))
        ImageDraw.Draw(img).rectangle([x, 540, x + int(520 * a3), 546], fill=GOLD)
        draw_text(img, (x, 580), "S.D. Barman College", font(56, "SemiBold", False), OFFWHITE, a3)
        draw_text(img, (x, 650), "Tripura", font(36, "Medium", False), GREY, a3)


class BurmanCard(CardScene):
    def draw(self, img, t):
        W, H = self.W, self.H
        a = ease_out(prog(t, 0.2, 0.7))
        draw_text(img, (W / 2, 250), "TRIPURA AND HINDI FILM MUSIC", font(36, "Bold"), GOLD_L, a, anchor="mm", tracking=10)
        a2 = ease_out(prog(t, 0.8, 0.8))
        draw_text(img, (W / 2, 420 + (1 - a2) * 20), "Sachin Dev Burman", serif(110), WHITE, a2, anchor="mm")
        draw_text(img, (W / 2, 530), "1906 – 1975", font(44, "Medium", False), GOLD_L, a2, anchor="mm", tracking=6)
        a3 = ease_out(prog(t, 1.6, 0.8))
        draw_text(img, (W / 2, 640), "Composer · Belonged to Tripura's royal family", font(42, "SemiBold", False), OFFWHITE, a3, anchor="mm")
        rd = getattr(self, "show_rd", None)
        if rd is not None:
            a4 = ease_out(prog(t, rd, 0.8))
            draw_text(img, (W / 2, 720), "His son: Rahul Dev Burman (1939 – 1994)", font(36, "Medium", False), GOLD_L, a4, anchor="mm")
        waveform(img, W / 2, 820, 1100, 90, t, bars=90, color=GOLD, alpha=0.45 * a)


class TimelineCard(CardScene):
    def draw(self, img, t):
        W, H = self.W, self.H
        heading(img, 120, 140, "A CAREER BUILT STEP BY STEP", t, 0.1, 58)
        y = 560
        x0, x1 = 300, W - 300
        p = ease_in_out(prog(t, 0.6, 3.0))
        d = ImageDraw.Draw(img)
        d.line([(x0, y), (x0 + (x1 - x0) * p, y)], fill=GOLD + (255,), width=6)
        stops = [("2017", "Moved to Mumbai", "To build a professional\nsinging career"),
                 ("THE GRIND", "Professional work", "Television series, albums,\nfilms, ads, live shows"),
                 ("NOW", "Bollywood opportunity", "Madirapan,\nMaatrubhumi")]
        for i, (big, title, sub) in enumerate(stops):
            xs = x0 + (x1 - x0) * (i / 2)
            at = 0.6 + 3.0 * (i / 2)
            a = ease_out(prog(t, at, 0.6))
            if a <= 0:
                continue
            r = 18 + 6 * a
            d.ellipse([xs - r, y - r, xs + r, y + r], fill=NAVY + (255,), outline=GOLD + (255,), width=6)
            d.ellipse([xs - 8, y - 8, xs + 8, y + 8], fill=WHITE + (int(255 * a),))
            draw_text(img, (xs, y - 120 + (1 - a) * 20), big, font(64, "Black"), GOLD_L if i < 2 else WHITE, a, anchor="mm", tracking=2)
            draw_text(img, (xs, y + 80), title, font(40, "Bold"), WHITE, a, anchor="mm")
            for k, line in enumerate(sub.split("\n")):
                draw_text(img, (xs, y + 135 + k * 44), line, font(32, "Medium", False), GREY, a, anchor="mm")


class AmbitionsCard(CardScene):
    photo = "red"

    def draw(self, img, t):
        heading(img, 120, 160, "HER AMBITIONS", t, 0.1, 66)
        rows = ["A recognised playback singer", "Romantic, soulful, emotional,",
                "rock and contemporary music", "Working with A.R. Rahman", "A distinct identity within five years"]
        f = font(42, "SemiBold", False)
        # rows 1 and 2 are one item; draw manually
        items = [("A recognised playback singer", None), ("Romantic, soulful, emotional,", "rock and contemporary music"),
                 ("Working with A.R. Rahman", None), ("A distinct identity within five years", None)]
        y = 320
        times = getattr(self, "item_times", None) or [0.8 + i * 0.9 for i in range(4)]
        for i, (l1, l2) in enumerate(items):
            a = ease_out(prog(t, times[i], 0.5))
            if a > 0:
                off = (1 - a) * 30
                d = ImageDraw.Draw(img)
                draw_text(img, (120 + off, y), f"0{i+1}", font(44, "Black"), GOLD, a)
                draw_text(img, (210 + off, y), l1, f, OFFWHITE, a)
                if l2:
                    draw_text(img, (210 + off, y + 54), l2, f, OFFWHITE, a)
            y += 150 if l2 else 100


class MessageCard(CardScene):
    def draw(self, img, t):
        W, H = self.W, self.H
        a = ease_out(prog(t, 0.1, 0.6))
        draw_text(img, (W / 2, 200), "HER MESSAGE TO YOUNG SINGERS", font(56, "Black"), WHITE, a, anchor="mm", tracking=3)
        ImageDraw.Draw(img).rectangle([W / 2 - 70, 250, W / 2 + 70, 256], fill=GOLD + (int(255 * a),))
        items = [("BELIEVE", "in your dreams"), ("PRACTISE", "consistently"), ("BE PATIENT", "keep going"),
                 ("DON'T FEAR", "rejection or failure")]
        cw = 380
        x0 = (W - 4 * cw - 3 * 30) / 2
        times = getattr(self, "item_times", None) or [0.8 + i * 0.6 for i in range(4)]
        for i, (big, small) in enumerate(items):
            at = times[i]
            a = ease_out(prog(t, at, 0.6))
            if a <= 0:
                continue
            x = x0 + i * (cw + 30)
            y = 380 + (1 - a) * 40
            lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
            ImageDraw.Draw(lay).rounded_rectangle([x, y, x + cw, y + 330], radius=16, fill=(255, 255, 255, int(18 * a)), outline=GOLD + (int(200 * a),), width=2)
            img.alpha_composite(lay)
            draw_text(img, (x + cw / 2, y + 90), f"0{i+1}", font(54, "Black"), GOLD, a, anchor="mm")
            draw_text(img, (x + cw / 2, y + 185), big, font(46, "Black"), WHITE, a, anchor="mm", tracking=2)
            draw_text(img, (x + cw / 2, y + 245), small, font(34, "Medium", False), GOLD_L, a, anchor="mm")
        waveform(img, W / 2, 860, 1300, 60, t, bars=110, color=GOLD, alpha=0.35)


class CreditsTitle(VideoScene):
    """Film & song title sequence over a heavily blurred, darkened song-video backdrop."""
    src = OFFICIAL
    start = 5.0
    singers_line = True

    def base(self, t):
        fr = self.reader().next()
        W, H = self.W, self.H
        bg = fast_blur_bg(fr.crop((0, 54, fr.width, 536)), W, H, 0.72).convert("RGBA")
        bg.alpha_composite(vignette(W, H, 0.7))
        cx = W / 2
        s = 1.0 if not self.vertical else 0.62
        ytop = H * (0.22 if not self.vertical else 0.25)
        a1 = ease_out(prog(t, 0.2, 1.0))
        draw_text(bg, (cx, ytop), "FILM", font(30 * s / 0.8 if self.vertical else 30, "Bold"), GOLD_L, a1, anchor="mm", tracking=12)
        draw_text(bg, (cx, ytop + 85 * (1 if not self.vertical else 0.9)), "MAATRUBHUMI", serif(96 if not self.vertical else 92), WHITE, a1, anchor="mm", tracking=int(14 * (1 - a1) + 8))
        a2 = ease_out(prog(t, 1.3, 1.0))
        draw_text(bg, (cx, ytop + 190), "SONG", font(30, "Bold"), GOLD_L, a2, anchor="mm", tracking=12)
        draw_text(bg, (cx, ytop + 290), "MADIRAPAN", font(130 if not self.vertical else 118, "Black"), GOLD, a2, anchor="mm", tracking=int(20 * (1 - a2) + 6))
        rows = [("MUSIC", "Himesh Reshammiya"), ("LYRICS", "Sameer Anjaan"), ("SINGERS", "Javed Ali · Mohd Danish · Soumee Sailesh")]
        if self.vertical:
            rows = [("MUSIC", "Himesh Reshammiya"), ("LYRICS", "Sameer Anjaan"), ("SINGERS", "Javed Ali · Mohd Danish"), ("", "Soumee Sailesh")]
        y = ytop + (430 if not self.vertical else 440)
        if not self.vertical:
            fk, fv = font(30, "Bold"), font(46, "SemiBold", False)
            kw = max(text_size(k, fk, 8)[0] for k, _ in rows); vw = max(fv.getlength(v) for _, v in rows)
            cx = W / 2 + (kw - vw) / 2
        for i, (k, v) in enumerate(rows):
            a = ease_out(prog(t, 2.4 + i * 0.5, 0.6))
            if self.vertical:
                if k:
                    draw_text(bg, (cx, y), k, font(30, "Bold"), GOLD_L, a, anchor="mm", tracking=8)
                    y += 50
                draw_text(bg, (cx, y), v, font(54, "Bold"), WHITE if "Soumee" not in v else GOLD_L, a, anchor="mm")
                y += 90
            else:
                draw_text(bg, (cx - 20, y), k, font(30, "Bold"), GOLD_L, a, anchor="rm", tracking=8)
                draw_text(bg, (cx + 20, y), v, font(46, "SemiBold", False), WHITE, a, anchor="lm")
                y += 72
        a4 = ease_out(prog(t, 4.2, 0.6))
        draw_text(bg, (W / 2, H - (110 if not self.vertical else 420)), "Singers as credited in the official song video", font(26, "Medium", False), GREY, a4, anchor="mm")
        return bg


class TitleCard(Scene):
    """Opening / closing cinematic title over a framed photo backdrop."""
    photo = "mic"
    lines = ()   # (text, kind) kind in big|small|accent
    def base(self, t):
        W, H = self.W, self.H
        if not hasattr(self, "_ph"):
            self._ph = grade(load_rgb(PH[self.photo]), warm=0.02)
            self._vig = vignette(W, H, 0.75)
        p = t / self.dur
        img = kenburns(self._ph, W, H, p, 1.06, 1.14, (0.5, 0.36), (0.5, 0.32))
        img = Image.blend(img, Image.new("RGB", (W, H), NAVY), 0.55).convert("RGBA")
        img.alpha_composite(self._vig)
        sc = 1.0 if not self.vertical else 0.9
        total = sum({"big": 150, "small": 70, "accent": 90, "name": 170}[k] for _, k in self.lines) * sc
        y = H / 2 - total / 2
        for i, (txt, kind) in enumerate(self.lines):
            a = ease_out(prog(t, 0.3 + i * 0.6, 0.9))
            if kind == "big":
                f = font((100 if not self.vertical else 86) * 1.0, "Black"); col = WHITE; trk = 4; hh = 150
            elif kind == "name":
                f = serif(130 if not self.vertical else 84); col = GOLD_L; trk = 6 if not self.vertical else 2; hh = 170
            elif kind == "accent":
                f = font(52 if not self.vertical else 46, "Bold"); col = GOLD; trk = 10; hh = 90
            else:
                f = font(44 if not self.vertical else 40, "Medium", False); col = OFFWHITE; trk = 2; hh = 70
            hh *= sc
            lines = wrap(txt, f, W * 0.86) if self.vertical else [txt]
            for j, ln in enumerate(lines):
                if j:
                    y += f.size * 1.2
                draw_text(img, (W / 2, y + hh / 2 + (1 - a) * 25), ln, f, col, a, anchor="mm", tracking=int(trk * sc))
            y += hh
        # gold rule
        a = ease_out(prog(t, 0.3 + len(self.lines) * 0.6, 0.8))
        w = int(220 * a)
        ImageDraw.Draw(img).rectangle([W / 2 - w, y + 10, W / 2 + w, y + 15], fill=GOLD)
        return img


class EndCard(Scene):
    bug = False
    drift = True
    disclosure = ("Hindi narration: AI voice generated with ElevenLabs (DN News voice)  ·  Background score: generated with ElevenLabs",
                  "Song excerpts: Madirapan, Maatrubhumi, courtesy Salman Khan Films Music, used for news reporting",
                  "Interview and photographs: Soumee Sailesh  ·  Map data: Natural Earth (India boundary as per Government of India)")

    def base(self, t):
        W, H = self.W, self.H
        img = bg_navy(W, H).copy().convert("RGBA")
        a = ease_out(prog(t, 0.2, 0.9))
        s = 1.0 if not self.vertical else 1.1
        f = font(120 * s, "Black")
        w1 = f.getlength("INSIGHT"); w2 = f.getlength("NE")
        x = W / 2 - (w1 + w2) / 2
        y = H * (0.40 if not self.vertical else 0.38)
        draw_text(img, (x, y + (1 - a) * 30), "INSIGHT", f, WHITE, a, anchor="lm")
        draw_text(img, (x + w1, y + (1 - a) * 30), "NE", f, GOLD, a, anchor="lm")
        b = ease_out(prog(t, 0.8, 0.8))
        ImageDraw.Draw(img).rectangle([W / 2 - 260 * b, y + 90 * s, W / 2 + 260 * b, y + 96 * s], fill=GOLD)
        draw_text(img, (W / 2, y + 150 * s), "News from Tripura and Northeast India", font(40 * s, "Medium", False), OFFWHITE, b, anchor="mm")
        c = ease_out(prog(t, 1.6, 0.8))
        fs = font(24 if not self.vertical else 26, "Medium", False)
        yy = H - (190 if not self.vertical else 470)
        for ln in self.disclosure:
            for sub in (wrap(ln, fs, W * 0.9)):
                draw_text(img, (W / 2, yy), sub, fs, GREY, c, anchor="mm", shadow=False)
                yy += 40
        return img


# ---------------------------------------------------------------------------
# Overlays
def chapter_overlay(num, title, start=0.2, dur=3.6):
    def ov(img, t, sc):
        tt = t - start
        if tt < 0 or tt > dur:
            return
        W, H = sc.W, sc.H
        a = min(ease_out(prog(tt, 0, 0.6)), 1 - ease_out(prog(tt, dur - 0.6, 0.6)))
        s = 1.0 if not sc.vertical else 1.0
        x, y = (110, 150) if not sc.vertical else (80, 360)
        band = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(band).rectangle([0, y - 70, int(W * 0.62), y + 110], fill=(4, 10, 28, int(150 * a)))
        img.alpha_composite(band.filter(ImageFilter.GaussianBlur(30)))
        draw_text(img, (x, y - 20), f"CHAPTER {num}", font(28, "Bold"), GOLD_L, a, tracking=8)
        draw_text(img, (x, y + 20 + (1 - a) * 16), title, font(64 if not sc.vertical else 54, "Black"), WHITE, a, tracking=2)
    return ov


def lt_overlay(name, role, start=0.6, dur=5.0, y=None):
    def ov(img, t, sc):
        if sc.vertical:
            lower_third_v(img, t - start, name, role, sc.W, sc.H, dur)
        else:
            lower_third(img, t - start, name, role, sc.W, sc.H, dur, y)
    return ov


def lower_third_v(img, t, name, role, W, H, dur):
    if t < 0 or t > dur:
        return
    a = min(ease_out(prog(t, 0, 0.5)), 1 - ease_out(prog(t, dur - 0.5, 0.5)))
    x, y = 70, 300
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    fn, fr = font(60, "Black"), font(34, "SemiBold", False)
    w = max(fn.getlength(name), fr.getlength(role)) + 60
    d.rectangle([x, y, x + w * ease_out(prog(t, 0.05, 0.5)), y + 84], fill=NAVY + (int(230 * a),))
    d.rectangle([x, y + 84, x + max(w * 0.85, fr.getlength(role) + 52) * ease_out(prog(t, 0.15, 0.5)), y + 134], fill=(255, 255, 255, int(235 * a)))
    d.rectangle([x - 10, y, x - 2, y + 134], fill=GOLD + (int(255 * a),))
    img.alpha_composite(lay)
    draw_text(img, (x + 26, y + 42), name, fn, WHITE, a, anchor="lm", shadow=False)
    draw_text(img, (x + 26, y + 110), role, fr, NAVY, a, anchor="lm", shadow=False)


def tag_overlay(text, pos="tl"):
    def ov(img, t, sc):
        label_tag(img, text, sc.W, sc.H, 0.85 * clamp(t / 0.4), pos=pos)
    return ov


def quote_overlay(lines, attribution="Soumee Sailesh · translated from Bengali", start=0.4, side="right"):
    """Animated quotation panel beside the interview (only her actual words)."""
    def ov(img, t, sc):
        if sc.vertical:
            return
        W, H = sc.W, sc.H
        a = min(ease_out(prog(t, start, 0.8)), 1 - ease_out(prog(t, sc.dur - 0.5, 0.5)))
        if a <= 0:
            return
        vx, _, vw, _ = getattr(sc, "_vid_box", (W // 2 - 300, 0, 600, H))
        if side == "right":
            x0 = vx + vw + 70; x1 = W - 90
        else:
            x0 = 90; x1 = vx - 70
        fq = serif(150)
        draw_text(img, (x0, 300), "“", fq, GOLD, a * 0.9)
        f = font(50, "Bold")
        y = 420
        for ln in lines:
            for sub in wrap(ln, f, x1 - x0):
                draw_text(img, (x0, y + (1 - a) * 20), sub, f, WHITE, a)
                y += 64
        ImageDraw.Draw(img).rectangle([x0, y + 20, x0 + 80 * a, y + 25], fill=GOLD)
        draw_text(img, (x0, y + 50), attribution, font(26, "Medium", False), GOLD_L, a)
    return ov


def side_text_overlay(big, small, side="left", start=0.4):
    """Large label beside a centred interview (e.g. name and place)."""
    def ov(img, t, sc):
        if sc.vertical:
            return
        W, H = sc.W, sc.H
        a = min(ease_out(prog(t, start, 0.8)), 1 - ease_out(prog(t, sc.dur - 0.5, 0.5)))
        vx, _, vw, _ = getattr(sc, "_vid_box", (W // 2 - 300, 0, 600, H))
        if side == "left":
            x = vx - 70; anc = "rm"
        else:
            x = vx + vw + 70; anc = "lm"
        draw_text(img, (x, H * 0.42), big, font(56, "Black"), WHITE, a, anchor=anc, tracking=2)
        draw_text(img, (x, H * 0.42 + 64), small, font(32, "Medium", False), GOLD_L, a, anchor=anc)
    return ov


def wave_overlay(y=0.88, alpha=0.4, width=0.5):
    def ov(img, t, sc):
        waveform(img, sc.W / 2, sc.H * y, sc.W * width, 50, t, bars=70, color=GOLD, alpha=alpha)
    return ov


def text_overlay(lines, start=0.3, pos="lower", size=64):
    """Big on-screen statement (used in shorts and title moments)."""
    def ov(img, t, sc):
        W, H = sc.W, sc.H
        a = min(ease_out(prog(t, start, 0.5)), 1 - ease_out(prog(t, sc.dur - 0.35, 0.35)))
        if a <= 0:
            return
        y = {"lower": H * 0.62, "upper": H * 0.2, "mid": H * 0.45}[pos]
        for i, (txt, col) in enumerate(lines):
            f = font(size if i == 0 else size * 0.62, "Black" if i == 0 else "Bold")
            for ln in wrap(txt, f, W * 0.86):
                draw_text(img, (W / 2, y + (1 - a) * 20), ln, f, col, a, anchor="mm", tracking=2 if i == 0 else 1, shadow_alpha=0.85, shadow_r=10)
                y += f.size * 1.2
    return ov


class ChapterSlate(Scene):
    """Chapter opener: number and title over a softly blurred portrait."""
    num = 1
    title = ""
    photo = "mic"

    def base(self, t):
        W, H = self.W, self.H
        if not hasattr(self, "_bg"):
            ph = grade(load_rgb(PH[self.photo]), warm=0.02)
            self._bg = blurred_bg(ph, W, H, 30, 0.62)
            self._vig = vignette(W, H, 0.6)
        z = 1.0 + 0.04 * t / self.dur
        img = self._bg.resize((int(W * z), int(H * z)), Image.BILINEAR)
        img = img.crop(((img.width - W) // 2, (img.height - H) // 2, (img.width - W) // 2 + W, (img.height - H) // 2 + H)).convert("RGBA")
        img.alpha_composite(self._vig)
        a = min(ease_out(prog(t, 0.2, 0.7)), 1 - ease_out(prog(t, self.dur - 0.5, 0.5)))
        cx, cy = W / 2, H / 2
        draw_text(img, (cx, cy - 90), f"CHAPTER {self.num}", font(34, "Bold"), GOLD_L, a, anchor="mm", tracking=14)
        f = font(84 if W > H else 64, "Black")
        y = cy + 10
        for ln in (wrap(self.title, f, W * 0.86)):
            draw_text(img, (cx, y + (1 - a) * 20), ln, f, WHITE, a, anchor="mm", tracking=3)
            y += f.size * 1.15
        w = int(160 * ease_out(prog(t, 0.6, 0.8)) * (1 - prog(t, self.dur - 0.5, 0.5)))
        ImageDraw.Draw(img).rectangle([cx - w, y + 10, cx + w, y + 16], fill=GOLD)
        return img


class HeroCard(CardScene):
    """Her credit on the song, as listed in the brief and the official video."""
    photo = "red"
    photo_side = "left"

    def draw(self, img, t):
        x = 860
        a = ease_out(prog(t, 0.2, 0.6))
        draw_text(img, (x, 300), "PLAYBACK VOCALS", font(36, "Bold"), GOLD_L, a, tracking=10)
        a2 = ease_out(prog(t, 0.6, 0.8))
        draw_text(img, (x, 375 + (1 - a2) * 20), "SOUMEE SAILESH", serif(84), WHITE, a2)
        a3 = ease_out(prog(t, 1.2, 0.7))
        ImageDraw.Draw(img).rectangle([x, 520, x + int(560 * a3), 526], fill=GOLD)
        draw_text(img, (x, 570), "Madirapan · Maatrubhumi", font(50, "SemiBold", False), OFFWHITE, a3)
        draw_text(img, (x, 640), "Music: Himesh Reshammiya", font(36, "Medium", False), GREY, a3)
        waveform(img, x + 420, 800, 840, 70, t, bars=70, color=GOLD, alpha=0.45 * a3)
