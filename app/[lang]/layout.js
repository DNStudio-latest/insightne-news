// The layout of every public page. The language comes from the first part of the address: the plain address is
// English, /bn/... is Bengali, and so on (see lib/languages.js). A page that only depends on its address can be
// kept ready by the website for a minute (see "revalidate" in each page), so readers get it quickly.
import "../globals.css";
import { notFound } from "next/navigation";
import { fontClasses } from "../fonts.js";
import { siteMetadata, siteViewport } from "../site-metadata.js";
import { SiteAnalytics } from "../client.js";
import { LANGUAGE_CODES, INDEXED_LANGUAGES } from "../../lib/languages.js";
import { initLang } from "../../lib/lang.js";

export const viewport = siteViewport;

// No pages are made in advance: each page is made the first time it is visited, then kept ready (see revalidate).
export function generateStaticParams() {
  return [];
}

const OG_LOCALE = { en: "en_IN", bn: "bn_IN", hi: "hi_IN", as: "as_IN", ne: "ne_NP", trp: "en_IN" };

export async function generateMetadata({ params }) {
  const { lang } = await params;
  if (!LANGUAGE_CODES.includes(lang)) return siteMetadata;
  return {
    ...siteMetadata,
    openGraph: { ...siteMetadata.openGraph, locale: OG_LOCALE[lang] || "en_IN" },
    // Languages whose machine translations have not been reviewed stay readable but out of search results.
    ...(INDEXED_LANGUAGES.includes(lang) ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function SiteLayout({ children, params }) {
  const { lang } = await params;
  if (!LANGUAGE_CODES.includes(lang)) notFound();
  await initLang(lang);
  return (
    <html lang={lang} className={fontClasses}>
      <body>
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
