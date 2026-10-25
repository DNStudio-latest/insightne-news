// Tells search engines what to list (everything except the private approval page).
import { settings } from "../lib/config.js";

export default function robots() {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api"] },
    sitemap: `${settings.siteUrl}/sitemap.xml`,
  };
}
