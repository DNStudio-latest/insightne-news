// The layout of the private approval pages (English only, never listed by search engines).
import "../globals.css";
import { fontClasses } from "../fonts.js";
import { siteMetadata, siteViewport } from "../site-metadata.js";

// The admin pages have their own web-app manifest (start at /admin), see app/admin-manifest.webmanifest/route.js.
export const metadata = { ...siteMetadata, manifest: "/admin-manifest.webmanifest" };
export const viewport = siteViewport;

export default function AdminLayout({ children }) {
  return (
    <html lang="en" className={fontClasses}>
      <body>{children}</body>
    </html>
  );
}
