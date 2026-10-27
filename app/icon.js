// The site's small icon (browser tab, phone home screen, alert messages).
import { ImageResponse } from "next/og";

export const size = { width: 192, height: 192 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#c8553d", color: "#fff", fontSize: 96, fontWeight: 800, borderRadius: 36 }}>
        NE
      </div>
    ),
    size,
  );
}
