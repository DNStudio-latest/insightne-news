"""Tripura -> Mumbai geographical animation.

Boundaries: Natural Earth 1:10m, India point-of-view edition
(ne_10m_admin_0_countries_ind), which follows India's official boundary,
plus Natural Earth 1:10m admin-1 for the Tripura state outline.
Coordinates: Khowai town 24.065 N, 91.605 E (Chebri is ~11 km from Khowai town);
Mumbai 19.076 N, 72.878 E.  Straight-line (great-circle) distance = 2,012 km,
shown rounded as "about 2,000 km".
"""
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import shape, box
from lib import *

GEO = os.environ.get("GEO_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "geo"))
KHOWAI = (91.605, 24.065)
MUMBAI = (72.8777, 19.0760)
COSF = math.cos(math.radians(22))


def _polys(g):
    if g.geom_type == "Polygon":
        return [g]
    return list(getattr(g, "geoms", []))


def load():
    d = json.load(open(os.path.join(GEO, "ne_10m_admin_0_countries_ind.geojson")))
    view = box(55, -2, 110, 45)
    countries = {}
    for f in d["features"]:
        g = shape(f["geometry"])
        if not g.intersects(view):
            continue
        g = g.intersection(view)
        countries[f["properties"]["ADM0_A3"]] = g
    s = json.load(open(os.path.join(GEO, "ne_10m_admin_1_states_provinces.geojson")))
    tripura = None
    for f in s["features"]:
        p = f["properties"]
        if p.get("adm0_a3") == "IND" and p.get("name") == "Tripura":
            tripura = shape(f["geometry"])
    simp = {}
    for tol in (0.03, 0.004):
        simp[tol] = {k: [np.array(p.exterior.coords) for p in _polys(v.simplify(tol))] for k, v in countries.items()}
    trip = {tol: [np.array(p.exterior.coords) for p in _polys(tripura.simplify(tol))] for tol in (0.01, 0.001)}
    return simp, trip


SIMP, TRIP = load()


class Cam:
    def __init__(self, lon, lat, scale, W, H, ss=2):
        self.lon, self.lat, self.s, self.W, self.H, self.ss = lon, lat, scale, W, H, ss

    def xy(self, lon, lat):
        x = (np.asarray(lon) - self.lon) * COSF * self.s + self.W / 2
        y = -(np.asarray(lat) - self.lat) * self.s + self.H / 2
        return x * self.ss, y * self.ss


def lerp_cam(a, b, e):
    # zoom interpolated logarithmically, centre linearly in screen-space terms
    s = math.exp(math.log(a[2]) * (1 - e) + math.log(b[2]) * e)
    w = (1 / a[2] - 1 / s) / (1 / a[2] - 1 / b[2]) if a[2] != b[2] else e
    return (a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w, s)


def draw_map(W, H, cam_t, tripura_glow=0.0, india_alpha=1.0, zoom_detail=False):
    ss = 2
    cam = Cam(*cam_t, W, H, ss)
    img = Image.new("RGB", (W * ss, H * ss), NAVY)
    d = ImageDraw.Draw(img, "RGBA")
    # graticule
    for lon in range(60, 110, 5):
        x, _ = cam.xy(lon, 0)
        d.line([(float(x), 0), (float(x), H * ss)], fill=(60, 90, 150, 28), width=ss)
    for lat in range(0, 45, 5):
        _, y = cam.xy(0, lat)
        d.line([(0, float(y)), (W * ss, float(y))], fill=(60, 90, 150, 28), width=ss)
    tol = 0.004 if (zoom_detail or cam.s > 120) else 0.03
    for k, polys in SIMP[tol].items():
        if k == "IND":
            continue
        for p in polys:
            x, y = cam.xy(p[:, 0], p[:, 1])
            pts = list(zip(x.tolist(), y.tolist()))
            if len(pts) > 2:
                d.polygon(pts, fill=(20, 38, 78, 255), outline=(70, 95, 150, 255))
    for p in SIMP[tol]["IND"]:
        x, y = cam.xy(p[:, 0], p[:, 1])
        pts = list(zip(x.tolist(), y.tolist()))
        if len(pts) > 2:
            d.polygon(pts, fill=(34, 78, 160, int(255 * india_alpha)))
            d.line(pts + [pts[0]], fill=GOLD_L + (int(200 * india_alpha),), width=max(1, int(1.2 * ss)))
    # Tripura
    ttol = 0.001 if cam.s > 120 else 0.01
    for p in TRIP[ttol]:
        x, y = cam.xy(p[:, 0], p[:, 1])
        pts = list(zip(x.tolist(), y.tolist()))
        a = int(255 * tripura_glow)
        d.polygon(pts, fill=GOLD + (a,))
        d.line(pts + [pts[0]], fill=(255, 240, 200, a), width=int(2 * ss))
    img = img.resize((W, H), Image.LANCZOS).convert("RGBA")
    return img, Cam(*cam_t, W, H, 1)


def marker(img, x, y, t, label, sub=None, side="r", alpha=1.0, s=1.0):
    if alpha <= 0:
        return
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(lay)
    pulse = (t * 0.8) % 1.0
    r = (10 + 34 * pulse) * s
    d.ellipse([x - r, y - r, x + r, y + r], outline=GOLD_L + (int(200 * (1 - pulse) * alpha),), width=int(3 * s))
    r = 9 * s
    d.ellipse([x - r, y - r, x + r, y + r], fill=WHITE + (int(255 * alpha),), outline=GOLD + (int(255 * alpha),), width=int(4 * s))
    img.alpha_composite(lay)
    f1, f2 = font(40 * s, "Bold"), font(24 * s, "Medium", False)
    if side == "r":
        draw_text(img, (x + 28 * s, y - (12 if sub else 0) * s), label, f1, WHITE, alpha, anchor="lm", tracking=2 * s)
        if sub:
            draw_text(img, (x + 28 * s, y + 26 * s), sub, f2, GOLD_L, alpha, anchor="lm")
    else:
        draw_text(img, (x - 28 * s, y - (12 if sub else 0) * s), label, f1, WHITE, alpha, anchor="rm", tracking=2 * s)
        if sub:
            draw_text(img, (x - 28 * s, y + 26 * s), sub, f2, GOLD_L, alpha, anchor="rm")


def arc_points(p0, p1, bend=0.22, n=200):
    p0, p1 = np.array(p0, float), np.array(p1, float)
    mid = (p0 + p1) / 2
    v = p1 - p0
    nrm = np.array([v[1], -v[0]])
    nrm /= (np.linalg.norm(nrm) + 1e-9)
    if nrm[1] > 0:
        nrm = -nrm
    c = mid + nrm * np.linalg.norm(v) * bend
    t = np.linspace(0, 1, n)[:, None]
    return (1 - t) ** 2 * p0 + 2 * (1 - t) * t * c + t ** 2 * p1


def draw_arc(img, pts, frac, s=1.0):
    if frac <= 0:
        return
    k = max(2, int(len(pts) * frac))
    seg = [tuple(p) for p in pts[:k]]
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.line(seg, fill=GOLD + (230,), width=int(14 * s), joint="curve")
    glow = glow.filter(ImageFilter.GaussianBlur(10 * s))
    img.alpha_composite(glow)
    d = ImageDraw.Draw(img, "RGBA")
    d.line(seg, fill=(255, 236, 190, 255), width=int(5 * s), joint="curve")
    hx, hy = seg[-1]
    d.ellipse([hx - 8 * s, hy - 8 * s, hx + 8 * s, hy + 8 * s], fill=WHITE)


def headline_block(img, W, H, t, a, vertical=False):
    s = W / 1920 if not vertical else 1.0
    if vertical:
        cx, y = W / 2, 250
        f1, f2 = font(64, "Black"), font(38, "SemiBold", False)
        draw_text(img, (cx, y), "CHEBRI, TRIPURA → MUMBAI", f1, WHITE, a, anchor="mm")
        draw_text(img, (cx, y + 75), "2017: A journey towards a dream", f2, GOLD_L, a, anchor="mm")
    else:
        x, y = 110 * s, 130 * s
        f1, f2 = font(70 * s, "Black"), font(38 * s, "SemiBold", False)
        draw_text(img, (x, y), "CHEBRI, TRIPURA → MUMBAI", f1, WHITE, a, anchor="lm", tracking=1)
        draw_text(img, (x, y + 70 * s), "2017 – A JOURNEY TOWARDS A DREAM", f2, GOLD_L, a, anchor="lm", tracking=3)


def distance_badge(img, W, H, a, x, y, s=1.0):
    if a <= 0:
        return
    f1, f2, f3 = font(84 * s, "Black"), font(30 * s, "SemiBold", False), font(22 * s, "Medium", False)
    w, h = 560 * s, 210 * s
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(lay).rounded_rectangle([x, y, x + w, y + h], radius=14 * s, fill=(6, 14, 36, int(215 * a)), outline=GOLD + (int(255 * a),), width=int(2 * s))
    img.alpha_composite(lay)
    draw_text(img, (x + 32 * s, y + 70 * s), "≈ 2,000 km", f1, WHITE, a, anchor="lm", shadow=False)
    draw_text(img, (x + 34 * s, y + 140 * s), "Approximate straight-line distance", f2, GOLD_L, a, anchor="lm", shadow=False)
    draw_text(img, (x + 34 * s, y + 180 * s), "Aerial distance, not road or travel distance", f3, GREY, a, anchor="lm", shadow=False)


def render(out, variant="full"):
    vertical = variant == "vertical"
    W, H = (1080, 1920) if vertical else (1920, 1080)
    s = 1.0
    if vertical:
        india = (82.6, 21.2, 34.0)
        trip = (91.75, 23.75, 420.0)
    else:
        india = (84.5, 22.0, 31.0)
        trip = (91.75, 23.75, 470.0)
    if variant in ("intro", "locator"):
        return render_simple(out, variant, W, H, india, trip)
    if variant == "full":
        # timeline (seconds)
        T = 22.0
        keys = [(0, india), (3.5, india), (6.5, trip), (9.0, trip), (11.5, india), (T, india)]
        trip_on, trip_label, zoom_lbl, arc_t0, arc_d, mum_t, dist_t, head_t = 1.0, 1.6, 6.6, 11.8, 4.0, 15.5, 16.5, 12.0
    else:  # short / vertical: no deep zoom
        T = 11.0 if not vertical else 9.0
        keys = [(0, india), (T, india)]
        trip_on, trip_label, zoom_lbl, arc_t0, arc_d, mum_t, dist_t, head_t = 0.4, 0.8, 99, 2.2, 2.8, 4.8, 5.6, 1.0
    wr = Writer(out, W, H)
    vig = vignette(W, H, 0.5)
    n = int(T * FPS)
    for i in range(n):
        t = i / FPS
        # camera
        for j in range(len(keys) - 1):
            if keys[j][0] <= t <= keys[j + 1][0]:
                e = ease_in_out(prog(t, keys[j][0], keys[j + 1][0] - keys[j][0]))
                cam_t = lerp_cam(keys[j][1], keys[j + 1][1], e)
                break
        else:
            cam_t = keys[-1][1]
        # slow drift so it never feels static
        cam_t = (cam_t[0], cam_t[1], cam_t[2] * (1 + 0.012 * math.sin(t * 0.4)))
        glow = ease_out(prog(t, trip_on, 1.0)) * (0.75 + 0.25 * math.sin(t * 3.0))
        img, cam = draw_map(W, H, cam_t, tripura_glow=glow)
        kx, ky = cam.xy(*KHOWAI)
        mx, my = cam.xy(*MUMBAI)
        kx, ky, mx, my = float(kx), float(ky), float(mx), float(my)
        zoomed = cam_t[2] > 200
        # labels
        la = ease_out(prog(t, trip_label, 0.6))
        if variant == "full":
            la *= 1 - prog(t, 3.5, 0.8) + prog(t, 10.8, 1.0) if t < 10.8 else 1
        if not zoomed:
            marker(img, kx, ky, t, "TRIPURA", "Northeast India", side="r", alpha=la, s=s)
        if variant == "full":
            za = ease_out(prog(t, zoom_lbl, 0.7)) * (1 - prog(t, 9.1, 0.6))
            if za > 0:
                marker(img, kx, ky, t, "CHEBRI, KHOWAI", "Khowai district, Tripura", side="r", alpha=za, s=1.1)
                f = font(30, "SemiBold", False)
                draw_text(img, (200, 560), "BANGLADESH", f, (150, 165, 200), za * 0.9, anchor="lm", tracking=6)
                draw_text(img, (W - 90, 900), "MYANMAR", f, (150, 165, 200), za * 0.8, anchor="rm", tracking=6)
                draw_text(img, (W / 2 + 40, 150), "TRIPURA", font(60, "Black"), GOLD_L, za, anchor="mm", tracking=10)
        # route
        p0, p1 = (kx, ky), (mx, my)
        pts = arc_points(p0, p1, bend=0.25)
        if not zoomed:
            fr = ease_in_out(prog(t, arc_t0, arc_d))
            draw_arc(img, pts, fr, s=1.0 if not vertical else 0.9)
            ma = ease_out(prog(t, mum_t, 0.6))
            marker(img, mx, my, t, "MUMBAI", "Maharashtra", side="l" if not vertical else "r", alpha=ma, s=s)
            ha = ease_out(prog(t, head_t, 0.8))
            headline_block(img, W, H, t, ha, vertical)
            da = ease_out(prog(t, dist_t, 0.7))
            if vertical:
                distance_badge(img, W, H, da, (W - 560 * 1.0) / 2, H - 520, 1.0)
            else:
                distance_badge(img, W, H, da, W - 560 - 110, H - 330, 1.0)
        img.alpha_composite(vig)
        label_tag(img, "GRAPHIC", W, H, 0.9, pos="br" if not vertical else "br")
        a = fade_io(t, T, 0.6, 0.6)
        if a < 1:
            img = Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 255)), img, a)
        wr.write(img)
    wr.close()


def render_simple(out, variant, W, H, india, trip):
    wr = Writer(out, W, H)
    vig = vignette(W, H, 0.5)
    T = 7.0 if variant == "intro" else 13.0
    mid = (90.0, 24.0, 95.0)
    for i in range(int(T * FPS)):
        t = i / FPS
        if variant == "intro":
            e = ease_in_out(prog(t, 0.5, T - 0.5))
            cam_t = lerp_cam(india, mid, e)
            glow = ease_out(prog(t, 1.2, 1.2)) * (0.75 + 0.25 * math.sin(t * 3))
            img, cam = draw_map(W, H, cam_t, tripura_glow=glow)
            kx, ky = map(float, cam.xy(*KHOWAI))
            marker(img, kx, ky, t, "TRIPURA", "Northeast India", side="r", alpha=ease_out(prog(t, 2.2, 0.8)))
        else:
            cam_t = (trip[0], trip[1], trip[2] * (1 + 0.03 * t / T))
            img, cam = draw_map(W, H, cam_t, tripura_glow=0.9)
            kx, ky = map(float, cam.xy(*KHOWAI))
            za = ease_out(prog(t, 0.6, 0.7))
            marker(img, kx, ky, t, "CHEBRI, KHOWAI", "Khowai district, Tripura", side="r", alpha=za, s=1.1)
            f = font(30, "SemiBold", False)
            draw_text(img, (200 if W > H else 60, H * 0.52), "BANGLADESH", f, (150, 165, 200), za * 0.9, anchor="lm", tracking=6)
            draw_text(img, (W / 2 + 40, 150 if W > H else 260), "TRIPURA", font(60, "Black"), GOLD_L, za, anchor="mm", tracking=10)
        img.alpha_composite(vig)
        label_tag(img, "GRAPHIC", W, H, 0.9, pos="br")
        a = fade_io(t, T, 0.6 if variant == "intro" else 0.3, 0.3)
        if a < 1:
            img = Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 255)), img, a)
        wr.write(img)
    wr.close()


if __name__ == "__main__":
    render(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "full")
