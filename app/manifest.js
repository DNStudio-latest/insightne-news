// Lets readers add the site to their phone's home screen (needed for alerts on iPhones).
import { settings } from "../lib/config.js";

export default function manifest() {
  return {
    name: settings.siteName,
    short_name: "InsightNE",
    description: settings.tagline,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#c8553d",
    icons: [{ src: "/icon", sizes: "192x192", type: "image/png" }],
  };
}
