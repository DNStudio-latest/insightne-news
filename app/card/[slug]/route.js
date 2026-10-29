// A big news-card picture (1080 × 1350) to post in the WhatsApp channel, Facebook or Instagram.
// /card/<story>?type=live | breaking | news   (English only: Bengali letters don't join correctly in these pictures)
// Add &format=jpg for a JPEG (Instagram only accepts JPEG pictures).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { db } from "../../../lib/db.js";
import { settings } from "../../../lib/config.js";
import { formatDate } from "../../../lib/format.js";
import { AI_CREDIT } from "../../../lib/images.js";

export const dynamic = "force-dynamic";

const W = 1080;
const H = 1350;
const LABELS = {
  live: { text: "LIVE", color: "#e53935" },
  breaking: { text: "BREAKING", color: "#e53935" },
  news: { text: "NEWS", color: "#c8553d" },
};

const font = (file) => readFile(path.join(process.cwd(), "assets", "fonts", file));

// The story's photo as a data link (only JPG/PNG work in these pictures). Nothing if it can't be loaded.
async function photo(url) {
  if (!url) return null;
  try {
    const res = await fetch(new URL(url, settings.siteUrl), { signal: AbortSignal.timeout(8000) });
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !/image\/(jpeg|png)/.test(type)) return null;
    return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

const headlineSize = (text) => (text.length <= 60 ? 76 : text.length <= 95 ? 66 : text.length <= 130 ? 56 : 48);

export async function GET(request, { params }) {
  const { slug } = await params;
  const story = await db.getStoryBySlug(slug).catch(() => null);
  if (story?.status !== "approved") return new Response("Story not found", { status: 404 });
  const label = LABELS[new URL(request.url).searchParams.get("type")] || LABELS.news;
  const [serif, sansBold, sans, image] = await Promise.all([
    font("noto-serif-latin-800-normal.woff"),
    font("noto-sans-latin-700-normal.woff"),
    font("noto-sans-latin-500-normal.woff"),
    photo(story.image_url),
  ]);
  const [first, ...rest] = settings.siteName.split(" ");
  const site = settings.siteUrl.replace(/^https?:\/\/(www\.)?/, "");
  const headline = story.headline.length > 170 ? `${story.headline.slice(0, 167)}…` : story.headline;

  const picture = new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: "#0a3540", color: "#fff", fontFamily: "Sans" }}>
        {/* Top bar: name + label */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 120, padding: "0 50px" }}>
          <div style={{ display: "flex", fontFamily: "Serif", fontSize: 50 }}>
            {first}
            <span style={{ color: "#ee8a70", marginLeft: 14 }}>{rest.join(" ")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", background: label.color, borderRadius: 12, padding: "12px 26px", fontSize: 38, fontWeight: 700, letterSpacing: 3 }}>
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "#fff", marginRight: 14 }} />
            {label.text}
          </div>
        </div>

        {/* Photo (or a coloured panel with the region when there is no photo) */}
        {image ? (
          <div style={{ display: "flex", position: "relative", width: W, height: 640 }}>
            <img src={image} width={W} height={640} style={{ objectFit: "cover" }} />
            {story.image_credit === AI_CREDIT && (
              <div style={{ position: "absolute", left: 24, bottom: 20, display: "flex", background: "rgba(0,0,0,0.6)", borderRadius: 8, padding: "6px 14px", fontSize: 24 }}>AI illustration</div>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: W, height: 420, background: "linear-gradient(135deg, #0f4c5c, #1f8a70)", fontFamily: "Serif", fontSize: 90, color: "rgba(255,255,255,0.9)" }}>
            {story.region}
          </div>
        )}

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, padding: "40px 50px 0" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: "#ee8a70", letterSpacing: 2, textTransform: "uppercase" }}>
            {story.region}
            {story.topic ? ` · ${story.topic}` : ""}
          </div>
          <div style={{ display: "flex", fontFamily: "Serif", fontSize: headlineSize(headline), lineHeight: 1.18, marginTop: 18 }}>{headline}</div>
          <div style={{ display: "flex", fontSize: 28, color: "#a9c5cb", marginTop: 22 }}>{formatDate(story.published_at)}</div>
        </div>

        {/* Bottom bar: where to read it */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 120, padding: "0 50px", background: "#c8553d" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700 }}>Read the full story</div>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 500 }}>{site}/s/{story.slug.split("-").pop()}</div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Serif", data: serif, weight: 800, style: "normal" },
        { name: "Sans", data: sansBold, weight: 700, style: "normal" },
        { name: "Sans", data: sans, weight: 500, style: "normal" },
      ],
      headers: { "Cache-Control": "no-store" },
    },
  );
  if (new URL(request.url).searchParams.get("format") !== "jpg") return picture;
  const jpeg = await sharp(Buffer.from(await picture.arrayBuffer())).jpeg({ quality: 88, mozjpeg: true }).toBuffer();
  return new Response(jpeg, { headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600" } });
}
