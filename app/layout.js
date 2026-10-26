import "./globals.css";
import { Noto_Serif, Inter } from "next/font/google";
import { settings } from "../lib/config.js";
import { SiteAnalytics } from "./client.js";

const serif = Noto_Serif({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata = {
  metadataBase: new URL(settings.siteUrl),
  title: { default: `${settings.siteName} — ${settings.tagline}`, template: `%s · ${settings.siteName}` },
  description: `${settings.tagline}. Latest news, original reports and videos from the eight states of Northeast India.`,
  openGraph: { siteName: settings.siteName, type: "website", locale: "en_IN" },
  twitter: { card: "summary_large_image" },
  alternates: { canonical: "/" },
};

export const viewport = { width: "device-width", initialScale: 1, themeColor: "#0f4c5c" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
