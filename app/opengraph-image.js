// The picture shown when a page without its own photo is shared on WhatsApp, Facebook or X.
import { ImageResponse } from "next/og";
import { settings } from "../lib/config.js";

export const alt = settings.siteName;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const [first, ...rest] = settings.siteName.split(" ");
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: 80, background: "linear-gradient(135deg, #0a3540, #0f4c5c 60%, #1f8a70)", color: "#fff" }}>
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>
          {first}
          <span style={{ color: "#ee8a70", marginLeft: 24 }}>{rest.join(" ")}</span>
        </div>
        <div style={{ fontSize: 40, marginTop: 20, opacity: 0.9 }}>{settings.tagline}</div>
        <div style={{ display: "flex", marginTop: 50, fontSize: 28, opacity: 0.75 }}>Tripura · Northeast · Politics · Education · Sports</div>
      </div>
    ),
    size,
  );
}
