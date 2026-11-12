// The site's fonts, shared by the public layout and the admin layout.
import { Roboto, Noto_Serif_Bengali, Noto_Sans_Bengali, Inter } from "next/font/google";

const headline = Roboto({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-headline", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Bengali letters: loaded with the site, so Bengali looks the same on every phone and computer
const bnSerif = Noto_Serif_Bengali({ subsets: ["bengali"], weight: ["600", "700"], variable: "--font-bn-serif", display: "swap" });
const bnSans = Noto_Sans_Bengali({ subsets: ["bengali"], weight: ["400", "500", "600", "700"], variable: "--font-bn-sans", display: "swap" });

export const fontClasses = `${headline.variable} ${sans.variable} ${bnSerif.variable} ${bnSans.variable}`;
