// The layout of the private approval pages (English only, never listed by search engines).
import "../globals.css";
import { fontClasses } from "../fonts.js";
import { siteMetadata, siteViewport } from "../site-metadata.js";

export const metadata = siteMetadata;
export const viewport = siteViewport;

export default function AdminLayout({ children }) {
  return (
    <html lang="en" className={fontClasses}>
      <body>{children}</body>
    </html>
  );
}
