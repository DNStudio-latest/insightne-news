import "./globals.css";
import { Playfair_Display, Noto_Serif_Bengali, Noto_Sans_Bengali, Inter } from "next/font/google";
import { settings } from "../lib/config.js";
import { SiteAnalytics } from "./client.js";
import { validLang } from "../lib/languages.js";
import { cookies } from "next/headers";

const serif = Playfair_Display({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Bengali letters: loaded with the site, so Bengali looks the same on every phone and computer
const bnSerif = Noto_Serif_Bengali({ subsets: ["bengali"], weight: ["600", "700"], variable: "--font-bn-serif", display: "swap" });
const bnSans = Noto_Sans_Bengali({ subsets: ["bengali"], weight: ["400", "500", "600", "700"], variable: "--font-bn-sans", display: "swap" });

export const metadata = {
  metadataBase: new URL(settings.siteUrl),
  title: { default: `${settings.siteName} — ${settings.tagline}`, template: `%s · ${settings.siteName}` },
  description: `${settings.tagline}. Latest news, original reports and videos from the eight states of Northeast India.`,
  openGraph: { siteName: settings.siteName, type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/", types: { "application/rss+xml": [{ url: "/feed.xml", title: settings.siteName }] } },
  // Google Search Console "HTML tag" code, if you use that way of proving the site is yours.
  ...(settings.googleSiteVerification ? { verification: { google: settings.googleSiteVerification } } : {}),
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0f4c5c" };

export default async function RootLayout({ children }) {
  const lang = validLang((await cookies()).get("lang")?.value);
  return (
    <html lang={lang} className={`${serif.variable} ${sans.variable} ${bnSerif.variable} ${bnSans.variable}`}>
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
