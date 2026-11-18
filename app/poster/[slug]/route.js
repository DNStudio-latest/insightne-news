// The InsightNE news poster (1920 × 1080) for a published story: the story's own photo with a headline panel, key
// points and the link. /poster/<story>[?format=jpg][&layout=left|right|bottom]. The photo is only cropped, evened out
// and lightly brightened (never redrawn); all text comes word for word from the story (lib/poster-text.js). The text goes
// where the people in the photo are not (lib/poster-layout.js). English only: Bengali letters do not join correctly in
// these pictures. A picture made from an AI illustration says so on the poster.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { db } from "../../../lib/db.js";
import { settings } from "../../../lib/config.js";
import { pictureOf } from "../../../lib/proof-shot.js";
import { AI_CREDIT } from "../../../lib/images.js";
import { posterContent, posterEligible } from "../../../lib/poster-text.js";
import { chooseLayout } from "../../../lib/poster-layout.js";

export const dynamic = "force-dynamic";

const W = 1920;
const H = 1080;
const NAVY = "#0a2540";
const YELLOW = "#ffd400";
const RED = "#e53935";
const LAYOUTS = ["bottom", "left", "right"];

// The poster shapes: "wide" 16:9 (the default), "landscape" 1.91:1 (Facebook's standard picture), "portrait" 4:5 (the tallest
// picture Instagram shows in full, so it takes the most room in the feed) and "square" 1:1. portrait and square are drawn
// "stacked": the photo on top, the text on its own panel below, so the text never covers the people.
export const SHAPES = {
  wide: { w: 1920, h: 1080 },
  landscape: { w: 1910, h: 1000 },
  portrait: { w: 1080, h: 1350, stacked: true, photo: 700 },
  square: { w: 1080, h: 1080, stacked: true, photo: 540 },
};

const font = (file) => readFile(path.join(process.cwd(), "assets", "fonts", file));

// The photo, cropped to 16:9 around its most striking part, with its brightness and contrast evened out and a little
// sharper, as a JPEG data link, plus the best place for the text (layout). `layout` (optional) forces one.
export async function preparedPhoto(url, w = W, h = H, { headlineLength = 0, layout = null } = {}) {
  try {
    const res = await fetch(new URL(url, settings.siteUrl), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()), { failOn: "none" })
      .rotate()
      .resize(w, h, { fit: "cover", position: sharp.strategy.attention })
      .normalise({ lower: 1, upper: 99 })
      .modulate({ brightness: 1.04, saturation: 1.08 })
      .linear(1.05, -3)
      .sharpen()
      .jpeg({ quality: 90 })
      .toBuffer();
    const chosen = LAYOUTS.includes(layout) ? layout : (await chooseLayout(jpeg, { headlineLength })).layout;
    return { url: `data:image/jpeg;base64,${jpeg.toString("base64")}`, layout: chosen };
  } catch {
    return null;
  }
}

// Gradient that darkens the side the text is on (and the bottom, for the bottom layout).
const shade = (layout, w, h, stripHeight = 0) =>
  layout === "bottom"
    ? { position: "absolute", left: 0, top: 0, width: w, height: h, display: "flex", background: "linear-gradient(180deg, rgba(10,37,64,0.5) 0%, rgba(10,37,64,0) 22%, rgba(10,37,64,0) 38%, rgba(10,37,64,0.92) 72%, rgba(10,37,64,0.98) 100%)" }
    : {
        position: "absolute",
        top: 0,
        bottom: stripHeight,
        [layout]: 0,
        width: Math.round(w * 0.58),
        display: "flex",
        background: `linear-gradient(${layout === "left" ? 90 : 270}deg, rgba(10,37,64,0.97) 0%, rgba(10,37,64,0.93) 60%, rgba(10,37,64,0) 100%)`,
      };

const HeadlineWords = ({ words, size, shadow = "0 3px 14px rgba(0,0,0,0.6)" }) => (
  <div style={{ display: "flex", flexWrap: "wrap", fontSize: size, fontWeight: 700, lineHeight: 1.08, textTransform: "uppercase", textShadow: shadow }}>
    {words.map((w, i) => (
      <span key={i} style={{ display: "flex", marginRight: size * 0.28, color: w.key ? YELLOW : "#fff" }}>{w.text}</span>
    ))}
  </div>
);

const headlineSize = (text) => (text.length <= 45 ? 96 : text.length <= 70 ? 84 : text.length <= 100 ? 72 : text.length <= 140 ? 62 : 52);
const sideSize = (text, hasPoints) => Math.round((text.length <= 45 ? 88 : text.length <= 70 ? 76 : text.length <= 100 ? 66 : 56) * (hasPoints ? 0.92 : 1));

// The news graphic for the website (variant=web): the AI illustration with the place and date, the headline and the brand
// on it, in two sizes. Text sizes are set per size, so the headline stays readable on a small card.
async function webGraphic(story, sizeName, layoutName) {
  const full = sizeName === "full";
  const [w, h] = full ? [1600, 900] : [1024, 576];
  const L = full ? { pad: 52, pill: 30, brand: 46, top: 38, sub: 30, max: 84 } : { pad: 32, pill: 26, brand: 36, top: 26, sub: 0, max: 66 };
  const original = pictureOf(story);
  const c = posterContent(story);
  const [sansBold, sans, prepared] = await Promise.all([font("noto-sans-latin-700-normal.woff"), font("noto-sans-latin-500-normal.woff"), preparedPhoto(original, w, h, { headlineLength: c.headline.length, layout: layoutName })]);
  // If the graphic cannot be made, show the plain illustration (never a broken picture).
  if (!prepared) return Response.redirect(new URL(original, settings.siteUrl), 307);
  const { url: photo, layout } = prepared;
  const side = layout !== "bottom";
  const size = Math.round(L.max * (side ? 0.92 : 1) * (c.headline.length <= 40 ? 1 : c.headline.length <= 70 ? 0.86 : c.headline.length <= 100 ? 0.74 : 0.62));
  const textBox = side
    ? { position: "absolute", top: L.top + 70, bottom: L.pad, [layout]: L.pad, width: Math.round(w * 0.5), display: "flex", flexDirection: "column", justifyContent: "center" }
    : { position: "absolute", left: L.pad, right: L.pad, bottom: L.pad, display: "flex", flexDirection: "column" };
  const picture = new ImageResponse(
    (
      <div style={{ width: w, height: h, display: "flex", position: "relative", background: NAVY, fontFamily: "Sans", color: "#fff" }}>
        <img src={photo} width={w} height={h} style={{ position: "absolute", left: 0, top: 0 }} />
        <div style={shade(layout, w, h)} />
        <div style={{ position: "absolute", [side ? layout : "left"]: L.pad, top: L.top, display: "flex", background: YELLOW, color: NAVY, fontSize: L.pill, fontWeight: 700, padding: "6px 16px", letterSpacing: 1 }}>{c.dateline}</div>
        <div style={{ position: "absolute", [layout === "right" ? "left" : "right"]: L.pad, top: L.top - 4, display: "flex", fontSize: L.brand, fontWeight: 700, textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>
          InsightNE<span style={{ color: YELLOW, marginLeft: 10 }}>News</span>
        </div>
        <div style={textBox}>
          <div style={{ display: "flex", width: 96, height: 8, background: YELLOW, marginBottom: 14 }} />
          <HeadlineWords words={c.words} size={size} />
          {L.sub > 0 && c.supporting && <div style={{ display: "flex", fontSize: L.sub, fontWeight: 500, color: "#dbe7f3", marginTop: 16, lineHeight: 1.3 }}>{c.supporting}</div>}
        </div>
      </div>
    ),
    { width: w, height: h, fonts: [{ name: "Sans", data: sansBold, weight: 700, style: "normal" }, { name: "Sans", data: sans, weight: 500, style: "normal" }] },
  );
  const webp = await sharp(Buffer.from(await picture.arrayBuffer())).webp({ quality: 84 }).toBuffer();
  // The address carries a version (v=) that changes with the story, so the picture may be kept for a year.
  return new Response(webp, { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable" } });
}

// The stacked poster (portrait and square): photo on top with the place and date, brand and AI label on it, and a navy
// panel below with the headline, one supporting line (and up to two key points when there is room), then the link.
async function stackedPoster(story, c, shape, asJpeg) {
  const { w, h, photo: photoH } = shape;
  const [sansBold, sans, prepared] = await Promise.all([font("noto-sans-latin-700-normal.woff"), font("noto-sans-latin-500-normal.woff"), preparedPhoto(pictureOf(story), w, photoH, { layout: "bottom" })]);
  if (!prepared) return new Response("The photo could not be loaded", { status: 502 });
  const ai = story.image_credit === AI_CREDIT;
  const link = `${settings.siteUrl.replace(/^https?:\/\/(www\.)?/, "")}/s/${story.slug.split("-").pop()}`;
  const len = c.headline.length;
  const size = Math.round((len <= 45 ? 84 : len <= 70 ? 72 : len <= 100 ? 62 : 52) * (w === h ? 0.92 : 1));
  const tall = h >= 1300;
  const showSub = c.supporting && len <= 110;
  const points = tall && len <= 60 ? c.points.slice(0, 2).filter((p) => p.length <= 90) : [];
  const picture = new ImageResponse(
    (
      <div style={{ width: w, height: h, display: "flex", flexDirection: "column", background: NAVY, fontFamily: "Sans", color: "#fff" }}>
        <div style={{ display: "flex", position: "relative", width: w, height: photoH }}>
          <img src={prepared.url} width={w} height={photoH} style={{ position: "absolute", left: 0, top: 0 }} />
          <div style={{ position: "absolute", left: 0, top: 0, width: w, height: photoH, display: "flex", background: "linear-gradient(180deg, rgba(10,37,64,0.55) 0%, rgba(10,37,64,0) 24%)" }} />
          <div style={{ position: "absolute", left: 40, top: 36, display: "flex", alignItems: "center" }}>
            {c.breaking && <div style={{ display: "flex", background: RED, color: "#fff", fontSize: 26, fontWeight: 700, padding: "8px 18px", letterSpacing: 2, marginRight: 12 }}>BREAKING</div>}
            <div style={{ display: "flex", background: YELLOW, color: NAVY, fontSize: 28, fontWeight: 700, padding: "8px 20px", letterSpacing: 1 }}>{c.dateline}</div>
          </div>
          <div style={{ position: "absolute", right: 40, top: 32, display: "flex", fontSize: 44, fontWeight: 700, textShadow: "0 2px 10px rgba(0,0,0,0.7)" }}>
            InsightNE<span style={{ color: YELLOW, marginLeft: 12 }}>News</span>
          </div>
          {ai && <div style={{ position: "absolute", left: 40, top: 100, display: "flex", background: "rgba(0,0,0,0.65)", fontSize: 20, fontWeight: 700, padding: "5px 12px", letterSpacing: 2 }}>AI ILLUSTRATION</div>}
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, padding: "10px 48px", borderTop: `8px solid ${YELLOW}` }}>
          <HeadlineWords words={c.words} size={size} shadow="none" />
          {showSub && <div style={{ display: "flex", fontSize: 30, fontWeight: 500, color: "#dbe7f3", marginTop: 20, lineHeight: 1.3 }}>{c.supporting}</div>}
          {points.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", marginTop: i ? 10 : 18 }}>
              <div style={{ display: "flex", width: 12, height: 12, background: YELLOW, marginTop: 10, marginRight: 14, flexShrink: 0 }} />
              <div style={{ display: "flex", fontSize: 26, fontWeight: 500, lineHeight: 1.3 }}>{p}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 72, padding: "0 48px", background: YELLOW, color: NAVY, fontSize: 30, fontWeight: 700 }}>
          <div style={{ display: "flex" }}>READ THE FULL STORY</div>
          <div style={{ display: "flex" }}>{link}</div>
        </div>
      </div>
    ),
    { width: w, height: h, fonts: [{ name: "Sans", data: sansBold, weight: 700, style: "normal" }, { name: "Sans", data: sans, weight: 500, style: "normal" }], headers: { "Cache-Control": "no-store" } },
  );
  if (!asJpeg) return picture;
  const jpeg = await sharp(Buffer.from(await picture.arrayBuffer())).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return new Response(jpeg, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
}

export async function GET(request, { params }) {
  const { slug } = await params;
  const story = await db.getStoryBySlug(slug).catch(() => null);
  if (!posterEligible(story)) return new Response("No poster for this story", { status: 404 });
  const query = new URL(request.url).searchParams;
  if (query.get("variant") === "web") {
    // Only AI illustrations get text on them; a real photo is never changed.
    return story.image_credit === AI_CREDIT && settings.poster?.webGraphics !== false ? webGraphic(story, query.get("size"), query.get("layout")) : new Response("No graphic for this story", { status: 404 });
  }
  const c = posterContent(story);
  const shapeName = SHAPES[query.get("shape")] ? query.get("shape") : "wide";
  const SHAPE = SHAPES[shapeName];
  if (SHAPE.stacked) return stackedPoster(story, c, SHAPE, query.get("format") === "jpg");
  // The wide shapes: the text is placed over the photo, on the clearer side (see lib/poster-layout.js).
  const W = SHAPE.w;
  const H = SHAPE.h;
  const [sansBold, sans, prepared] = await Promise.all([font("noto-sans-latin-700-normal.woff"), font("noto-sans-latin-500-normal.woff"), preparedPhoto(pictureOf(story), W, H, { headlineLength: c.headline.length, layout: query.get("layout") })]);
  if (!prepared) return new Response("The photo could not be loaded", { status: 502 });
  const { url: photo, layout } = prepared;
  const ai = story.image_credit === AI_CREDIT;
  const site = settings.siteUrl.replace(/^https?:\/\/(www\.)?/, "");
  const link = `${site}/s/${story.slug.split("-").pop()}`;
  const hasPoints = c.points.length > 0;
  const side = layout !== "bottom";
  const STRIP = 84;
  const bottomSize = headlineSize(c.headline);
  const sSize = sideSize(c.headline, hasPoints);

  const picture = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: NAVY, fontFamily: "Sans", color: "#fff" }}>
        <img src={photo} width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} />
        <div style={shade(layout, W, H, STRIP)} />

        {/* Top: place and date (on the text side), brand (on the other side) */}
        <div style={{ position: "absolute", [side ? layout : "left"]: 56, top: 44, display: "flex", alignItems: "center" }}>
          {c.breaking && <div style={{ display: "flex", background: RED, color: "#fff", fontSize: 34, fontWeight: 700, padding: "10px 24px", letterSpacing: 3, marginRight: 18 }}>BREAKING</div>}
          <div style={{ display: "flex", background: YELLOW, color: NAVY, fontSize: 34, fontWeight: 700, padding: "10px 26px", letterSpacing: 2 }}>{c.dateline}</div>
        </div>
        <div style={{ position: "absolute", [layout === "right" ? "left" : "right"]: 56, top: 38, display: "flex", fontSize: 62, fontWeight: 700, textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
          InsightNE<span style={{ color: YELLOW, marginLeft: 16 }}>News</span>
        </div>
        {ai && <div style={{ position: "absolute", [side ? layout : "left"]: 56, top: 122, display: "flex", background: "rgba(0,0,0,0.65)", fontSize: 24, fontWeight: 700, padding: "6px 14px", letterSpacing: 2 }}>AI ILLUSTRATION</div>}

        {side ? (
          /* Text on one side, the people on the other */
          <div style={{ position: "absolute", top: 176, bottom: STRIP + 30, [layout]: 56, width: 900, display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div style={{ display: "flex", width: 150, height: 10, background: YELLOW, marginBottom: 22 }} />
            <HeadlineWords words={c.words} size={sSize} />
            {c.supporting && <div style={{ display: "flex", fontSize: 32, fontWeight: 500, color: "#dbe7f3", marginTop: 24, lineHeight: 1.3 }}>{c.supporting}</div>}
            {hasPoints && (
              <div style={{ display: "flex", flexDirection: "column", marginTop: 26, borderTop: `4px solid ${YELLOW}`, paddingTop: 18 }}>
                {c.points.slice(0, 3).map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", marginTop: i ? 12 : 0 }}>
                    <div style={{ display: "flex", width: 14, height: 14, background: YELLOW, marginTop: 11, marginRight: 14, flexShrink: 0 }} />
                    <div style={{ display: "flex", fontSize: 27, fontWeight: 500, lineHeight: 1.3 }}>{p}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Text along the bottom, the people above it */
          <div style={{ position: "absolute", left: 56, right: 56, bottom: 120, display: "flex", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", width: hasPoints ? 1080 : 1700 }}>
              <div style={{ display: "flex", width: 150, height: 10, background: YELLOW, marginBottom: 22 }} />
              <HeadlineWords words={c.words} size={bottomSize} />
              {c.supporting && <div style={{ display: "flex", fontSize: 34, fontWeight: 500, color: "#dbe7f3", marginTop: 26, lineHeight: 1.3 }}>{c.supporting}</div>}
            </div>
            {hasPoints && (
              <div style={{ display: "flex", flexDirection: "column", width: 640, marginLeft: 60, background: "rgba(10,37,64,0.82)", borderTop: `8px solid ${YELLOW}`, padding: "26px 30px" }}>
                <div style={{ display: "flex", fontSize: 28, fontWeight: 700, color: YELLOW, letterSpacing: 3, marginBottom: 14 }}>KEY POINTS</div>
                {c.points.map((p, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", marginTop: i ? 14 : 0 }}>
                    <div style={{ display: "flex", width: 16, height: 16, background: YELLOW, marginTop: 11, marginRight: 16, flexShrink: 0 }} />
                    <div style={{ display: "flex", fontSize: 28, fontWeight: 500, lineHeight: 1.3 }}>{p}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bottom strip: where to read it */}
        <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: STRIP, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 56px", background: YELLOW, color: NAVY, fontSize: 36, fontWeight: 700 }}>
          <div style={{ display: "flex" }}>READ THE FULL STORY</div>
          <div style={{ display: "flex" }}>{link}</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Sans", data: sansBold, weight: 700, style: "normal" },
        { name: "Sans", data: sans, weight: 500, style: "normal" },
      ],
      headers: { "Cache-Control": "no-store" },
    },
  );
  if (query.get("format") !== "jpg") return picture;
  const jpeg = await sharp(Buffer.from(await picture.arrayBuffer())).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return new Response(jpeg, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
}
