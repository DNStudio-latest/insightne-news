"""Thumbnails for YouTube, Facebook and Instagram, from her own portraits."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
from lib import *
from scenes import PH, grade
OUT = os.path.join(ROOT, "04_GRAPHICS", "THUMBNAILS")

def photo_panel(name, W, H, cx=0.5, cy=0.4):
    im = grade(load_rgb(PH[name]), warm=0.03, contrast=1.08, sat=1.08)
    im = ImageEnhance.Sharpness(im).enhance(1.3)
    return cover(im, W, H, cx, cy)

def left_fade(W, H, x0, x1):
    g = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    for x in range(W):
        a = 255 if x < x0 else max(0, int(255 * (1 - (x - x0) / (x1 - x0)))) if x < x1 else 0
        d.line([(x, 0), (x, H)], fill=NAVY + (a,))
    return g

def logo(img, x, y, s=1.0, anchor="r"):
    f = font(44 * s, "Black")
    w1, w2 = f.getlength("INSIGHT"), f.getlength("NE")
    x0 = x - (w1 + w2) if anchor == "r" else x
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle([x0 - 16 * s, y - 32 * s, x0 + w1 + w2 + 16 * s, y + 32 * s], radius=8 * s, fill=NAVY + (230,))
    img.alpha_composite(lay)
    draw_text(img, (x0, y), "INSIGHT", f, WHITE, 1, anchor="lm", shadow=False)
    draw_text(img, (x0 + w1, y), "NE", f, GOLD, 1, anchor="lm", shadow=False)

def pill(img, x, y, txt, f, fill=RED, col=WHITE):
    w = f.getlength(txt)
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle([x, y, x + w + 44, y + f.size * 1.55], radius=10, fill=fill + (255,))
    img.alpha_composite(lay)
    draw_text(img, (x + 22, y + f.size * 0.78), txt, f, col, 1, anchor="lm", shadow=False)

def horizontal(W, H, photo, lines, tag, sub, fname, cx=0.5, cy=0.35):
    s = W / 1280
    img = Image.new("RGBA", (W, H), NAVY + (255,))
    pw = int(W * 0.56)
    img.paste(photo_panel(photo, pw, H, cx, cy), (W - pw, 0))
    img.alpha_composite(left_fade(W, H, int(W * 0.44), int(W * 0.58)))
    img.alpha_composite(vignette(W, H, 0.35))
    x = int(56 * s)
    pill(img, x, int(70 * s), tag, font(30 * s, "Black"))
    y = int(170 * s)
    for txt, col, size in lines:
        f = font(size * s, "Black")
        draw_text(img, (x, y), txt, f, col, 1, anchor="la", shadow_alpha=0.8, shadow_r=8)
        y += int(size * s * 1.08)
    ImageDraw.Draw(img).rectangle([x, y + 18 * s, x + 150 * s, y + 26 * s], fill=GOLD)
    fs = font(34 * s, "Bold", False)
    yy = y + 52 * s
    for ln in wrap(sub, fs, W * 0.45):
        draw_text(img, (x, yy), ln, fs, OFFWHITE, 1, anchor="la", shadow_alpha=0.8)
        yy += 44 * s
    logo(img, W - 30 * s, H - 50 * s, s)
    img.convert("RGB").save(os.path.join(OUT, fname), quality=92)

def vertical(fname):
    W, H = 1080, 1920
    img = bg_navy(W, H).copy().convert("RGBA")
    ph = photo_panel("red", W, 1300, 0.5, 0.12).convert("RGBA")
    img.alpha_composite(ph, (0, 620))
    img.alpha_composite(grad_rect(W, 260, NAVY, NAVY, a0=255, a1=0), (0, 620))
    img.alpha_composite(grad_rect(W, 560, NAVY, NAVY, a0=0, a1=245), (0, H - 560))
    pill(img, 70, 230, "MADIRAPAN · MAATRUBHUMI", font(36, "Black"))
    draw_text(img, (70, 320), "FROM TRIPURA", font(118, "Black"), WHITE, 1, shadow_alpha=0.8, shadow_r=10)
    draw_text(img, (70, 450), "TO BOLLYWOOD", font(118, "Black"), GOLD, 1, shadow_alpha=0.8, shadow_r=10)
    draw_text(img, (70, H - 400), "SOUMEE SAILESH", serif(86), WHITE, 1, shadow_alpha=0.8)
    draw_text(img, (70, H - 295), "Chebri, Khowai, Tripura", font(44, "Bold", False), GOLD_L, 1, shadow_alpha=0.8)
    logo(img, W - 60, 130, 1.0)
    img.convert("RGB").save(os.path.join(OUT, fname), quality=92)

os.makedirs(OUT, exist_ok=True)
sub = "Soumee Sailesh sings in Salman Khan's Maatrubhumi"
horizontal(1280, 720, "red", [("FROM TRIPURA", WHITE, 92), ("TO BOLLYWOOD", GOLD, 92)], "MADIRAPAN", sub, "youtube_thumbnail_A_1280x720.jpg")
horizontal(1280, 720, "mic", [("TRIPURA'S VOICE", WHITE, 84), ("IN A SALMAN", GOLD, 84), ("KHAN FILM", GOLD, 84)], "DOCUMENTARY", "Soumee Sailesh, from Chebri to Bollywood", "youtube_thumbnail_B_1280x720.jpg", cy=0.3)
horizontal(1280, 720, "jacket", [("FROM TRIPURA", WHITE, 92), ("TO BOLLYWOOD", GOLD, 92)], "SHORT", sub, "youtube_short16x9_thumbnail_1280x720.jpg", cy=0.28)
horizontal(1200, 630, "red", [("FROM TRIPURA", WHITE, 92), ("TO BOLLYWOOD", GOLD, 92)], "MADIRAPAN", sub, "facebook_1200x630.jpg")
vertical("reel_shorts_cover_1080x1920.jpg")
print("ok")
