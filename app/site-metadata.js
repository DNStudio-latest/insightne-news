// Default page details (title, description, social preview) shared by the public layout and the admin layout.
import { settings } from "../lib/config.js";

export const siteMetadata = {
  metadataBase: new URL(settings.siteUrl),
  title: { default: `${settings.siteName} — ${settings.tagline}`, template: `%s · ${settings.siteName}` },
  description: `${settings.tagline}. Latest headlines, original reports and videos from Tripura, Assam, Manipur, Meghalaya and more.`,
  // The picture for pages without their own photo is made by app/opengraph-image.js. It is named here because that file
  // sits outside the [lang] layout, so Next does not add it by itself.
  openGraph: { siteName: settings.siteName, type: "website", locale: "en_IN", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: settings.siteName }] },
  twitter: { card: "summary_large_image", images: ["/opengraph-image"] },
  alternates: { types: { "application/rss+xml": [{ url: "/feed.xml", title: settings.siteName }] } },
  // Google Search Console "HTML tag" code, if you use that way of proving the site is yours.
  ...(settings.googleSiteVerification ? { verification: { google: settings.googleSiteVerification } } : {}),
};

export const siteViewport = { width: "device-width", initialScale: 1, themeColor: "#0f4c5c" };
