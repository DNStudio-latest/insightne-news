// Default page details (title, description, social preview) shared by the public layout and the admin layout.
import { settings } from "../lib/config.js";

export const siteMetadata = {
  metadataBase: new URL(settings.siteUrl),
  title: { default: `${settings.siteName} — ${settings.tagline}`, template: `%s · ${settings.siteName}` },
  description: `${settings.tagline}. Latest news, original reports and videos from the eight states of Northeast India.`,
  openGraph: { siteName: settings.siteName, type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: settings.siteName }] } },
  // Google Search Console "HTML tag" code, if you use that way of proving the site is yours.
  ...(settings.googleSiteVerification ? { verification: { google: settings.googleSiteVerification } } : {}),
};

export const siteViewport = { width: "device-width", initialScale: 1, themeColor: "#0f4c5c" };
