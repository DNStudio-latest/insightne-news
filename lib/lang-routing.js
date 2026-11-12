// What the proxy (proxy.js) does with an address, as a plain function so it can be tested:
// - /en/...      -> redirect to the plain address (one address per page)
// - /bn/..., ... -> serve as it is (the pages live in app/[lang]/)
// - plain address, and the reader chose another language earlier -> redirect to that language's address
// - plain address otherwise -> serve the English page (/en/...) without changing the address bar
import { LANGUAGE_CODES } from "./languages.js";

export function routeForLanguage({ pathname, savedLang, method = "GET" }) {
  const first = pathname.split("/")[1] || "";
  if (first === "en") return { action: "redirect", status: 308, path: pathname.slice(3) || "/" };
  if (first && LANGUAGE_CODES.includes(first)) return { action: "next" };
  if (savedLang && savedLang !== "en" && LANGUAGE_CODES.includes(savedLang) && method === "GET") {
    return { action: "redirect", status: 307, path: pathname === "/" ? `/${savedLang}` : `/${savedLang}${pathname}` };
  }
  return { action: "rewrite", path: pathname === "/" ? "/en" : `/en${pathname}` };
}
