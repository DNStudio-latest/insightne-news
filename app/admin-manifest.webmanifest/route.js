// A separate "app" for the admin pages, so an icon saved to the iPhone Home Screen from /admin opens the Approvals page
// (the public site's manifest says to start at the homepage). It has its own id, so both icons can exist side by side.
import { settings } from "../../lib/config.js";

export function GET() {
  return Response.json(
    {
      id: "/admin",
      name: `${settings.siteName} Admin`,
      short_name: "InsightNE Admin",
      description: "Approvals and reporters' stories",
      start_url: "/admin",
      scope: "/admin",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#0f4c5c",
      icons: [{ src: "/icon", sizes: "192x192", type: "image/png" }],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } },
  );
}
