// English / Bengali. The reader's choice is kept in a "lang" cookie; each page calls initLang() first.
import { cache } from "react";
import { cookies } from "next/headers";

const store = cache(() => ({ lang: "en" }));

export async function initLang() {
  const value = (await cookies()).get("lang")?.value;
  store().lang = value === "bn" ? "bn" : "en";
  return store().lang;
}

export const lang = () => store().lang;

// A story's text in the reader's language: the Bengali version if there is one, otherwise English.
export function pick(story, field) {
  return (lang() === "bn" && story?.[`${field}_bn`]?.trim()) || story?.[field] || "";
}

const BN = {
  // Sections
  Home: "প্রথম পাতা",
  Northeast: "উত্তর-পূর্ব",
  "All Northeast": "সমগ্র উত্তর-পূর্ব",
  Tripura: "ত্রিপুরা",
  Assam: "আসাম",
  Meghalaya: "মেঘালয়",
  Manipur: "মণিপুর",
  Mizoram: "মিজোরাম",
  Nagaland: "নাগাল্যান্ড",
  "Arunachal Pradesh": "অরুণাচল প্রদেশ",
  Sikkim: "সিকিম",
  India: "ভারত",
  World: "বিশ্ব",
  Politics: "রাজনীতি",
  Education: "শিক্ষা",
  Sports: "খেলা",
  Originals: "নিজস্ব প্রতিবেদন",
  Videos: "ভিডিও",
  Search: "খুঁজুন",
  // Page words
  Latest: "সর্বশেষ",
  LATEST: "সর্বশেষ",
  "More →": "আরও →",
  "Across the Northeast": "উত্তর-পূর্ব জুড়ে",
  "News from the states": "রাজ্যগুলির খবর",
  "InsightNE Originals": "ইনসাইটএনই নিজস্ব প্রতিবেদন",
  "Most read today": "আজ সবচেয়ে বেশি পঠিত",
  "More news": "আরও খবর",
  "Original reports": "মূল প্রতিবেদন",
  "Also reported by": "অন্যান্য প্রতিবেদন",
  "Read the full story on": "পুরো খবর পড়ুন:",
  "Top 5 today": "আজকের সেরা ৫",
  "Search news": "খবর খুঁজুন",
  "No stories here yet. Please check back soon.": "এখনও কোনো খবর নেই। কিছুক্ষণ পরে আবার দেখুন।",
  "Load more stories →": "আরও খবর →",
  news: "খবর",
  Updated: "হালনাগাদ",
  Subscribe: "সাবস্ক্রাইব",
  Watch: "দেখুন",
  Breaking: "ব্রেকিং",
  "AI illustration": "এআই চিত্র",
  Original: "নিজস্ব",
  Photos: "ছবি",
  "News and stories from the eight states of Northeast India": "উত্তর-পূর্ব ভারতের আট রাজ্যের খবর ও কাহিনি",
  By: "লিখেছেন",
  "Brief · Source:": "সংক্ষিপ্ত · সূত্র:",
};

// Words on the page in the reader's language.
export function tr(text) {
  return lang() === "bn" ? BN[text] || text : text;
}
