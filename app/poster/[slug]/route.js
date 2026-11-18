// The InsightNE news poster (1920 × 1080) for a published story: the story's own photo with a headline panel, key
// points and the link. /poster/<story>[?format=jpg]. The photo is only cropped and lightly brightened (never redrawn);
// all text comes word for word from the story (lib/poster-text.js). English only: Bengali letters do not join
// correctly in these pictures. A picture made from an AI illustration says so on the poster.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { db } from "../../../lib/db.js";
import { settings } from "../../../lib/config.js";
import { pictureOf } from "../../../lib/proof-shot.js";
import { AI_CREDIT } from "../../../lib/images.js";
import { posterContent, posterEligible } from "../../../lib/poster-text.js";

export const dynamic = "force-dynamic";

const W = 1920;
const H = 1080;
const NAVY = "#0a2540";
const YELLOW = "#ffd400";
const RED = "#e53935";

const font = (file) => readFile(path.join(process.cwd(), "assets", "fonts", file));

// The photo, cropped to 16:9 around its most striking part, a little brighter and sharper, as a JPEG data link.
export async function preparedPhoto(url) {
  try {
    const res = await fetch(new URL(url, settings.siteUrl), { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const jpeg = await sharp(Buffer.from(await res.arrayBuffer()), { failOn: "none" })
      .rotate()
      .resize(W, H, { fit: "cover", position: sharp.strategy.attention })
      .modulate({ brightness: 1.05, saturation: 1.08 })
      .linear(1.06, -4)
      .sharpen()
      .jpeg({ quality: 90 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return null;
  }
}

const headlineSize = (text) => (text.length <= 45 ? 96 : text.length <= 70 ? 84 : text.length <= 100 ? 72 : text.length <= 140 ? 62 : 52);

export async function GET(request, { params }) {
  const { slug } = await params;
  const story = await db.getStoryBySlug(slug).catch(() => null);
  if (!posterEligible(story)) return new Response("No poster for this story", { status: 404 });
  const [sansBold, sans, photo] = await Promise.all([font("noto-sans-latin-700-normal.woff"), font("noto-sans-latin-500-normal.woff"), preparedPhoto(pictureOf(story))]);
  if (!photo) return new Response("The photo could not be loaded", { status: 502 });
  const c = posterContent(story);
  const ai = story.image_credit === AI_CREDIT;
  const site = settings.siteUrl.replace(/^https?:\/\/(www\.)?/, "");
  const link = `${site}/s/${story.slug.split("-").pop()}`;
  const size = headlineSize(c.headline);
  const hasPoints = c.points.length > 0;

  const picture = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: NAVY, fontFamily: "Sans", color: "#fff" }}>
        <img src={photo} width={W} height={H} style={{ position: "absolute", left: 0, top: 0 }} />
        {/* Darkens the lower part so the text is readable and the top of the photo stays clear */}
        <div style={{ position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", background: "linear-gradient(180deg, rgba(10,37,64,0.55) 0%, rgba(10,37,64,0) 22%, rgba(10,37,64,0) 38%, rgba(10,37,64,0.92) 72%, rgba(10,37,64,0.98) 100%)" }} />

        {/* Top: place and date, brand */}
        <div style={{ position: "absolute", left: 56, top: 44, display: "flex", alignItems: "center" }}>
          {c.breaking && (
            <div style={{ display: "flex", background: RED, color: "#fff", fontSize: 34, fontWeight: 700, padding: "10px 24px", letterSpacing: 3, marginRight: 18 }}>BREAKING</div>
          )}
          <div style={{ display: "flex", background: YELLOW, color: NAVY, fontSize: 34, fontWeight: 700, padding: "10px 26px", letterSpacing: 2 }}>{c.dateline}</div>
        </div>
        {/* The brand is always written "InsightNE News" (never in capitals). */}
        <div style={{ position: "absolute", right: 56, top: 38, display: "flex", fontSize: 62, fontWeight: 700, textShadow: "0 2px 12px rgba(0,0,0,0.7)" }}>
          InsightNE<span style={{ color: YELLOW, marginLeft: 16 }}>News</span>
        </div>

        {/* Bottom: headline, supporting line, key points */}
        <div style={{ position: "absolute", left: 56, right: 56, bottom: 120, display: "flex", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", width: hasPoints ? 1080 : 1700 }}>
            <div style={{ display: "flex", width: 150, height: 10, background: YELLOW, marginBottom: 22 }} />
            <div style={{ display: "flex", flexWrap: "wrap", fontSize: size, fontWeight: 700, lineHeight: 1.08, textTransform: "uppercase", textShadow: "0 3px 14px rgba(0,0,0,0.6)" }}>
              {c.words.map((w, i) => (
                <span key={i} style={{ display: "flex", marginRight: size * 0.28, color: w.key ? YELLOW : "#fff" }}>{w.text}</span>
              ))}
            </div>
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

        {ai && <div style={{ position: "absolute", right: 56, bottom: 132, display: "flex", background: "rgba(0,0,0,0.65)", fontSize: 24, fontWeight: 700, padding: "6px 14px", letterSpacing: 2 }}>AI ILLUSTRATION</div>}

        {/* Bottom strip: where to read it */}
        <div style={{ position: "absolute", left: 0, bottom: 0, width: W, height: 84, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 56px", background: YELLOW, color: NAVY, fontSize: 36, fontWeight: 700 }}>
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
  if (new URL(request.url).searchParams.get("format") !== "jpg") return picture;
  const jpeg = await sharp(Buffer.from(await picture.arrayBuffer())).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  return new Response(jpeg, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
}
