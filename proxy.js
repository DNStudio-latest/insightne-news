// Gives every language its own web address. English stays at the plain address (/story/x); the other languages
// live under a prefix (/bn/story/x). The pages themselves sit in app/[lang]/, so the plain address is quietly
// served from the English copy (/en/story/x) without changing what the reader sees in the address bar.
// The rules are in lib/lang-routing.js.
import { NextResponse } from "next/server";
import { routeForLanguage } from "./lib/lang-routing.js";

export const config = {
  // Everything except the private approval pages, scripts, files with an extension (images, sitemaps, feeds),
  // and the small service addresses (language switch, short links, news cards, icons, the AI-text checker).
  matcher: ["/((?!_next|api|admin|lang/|card/|s/|ai-tools|icon|opengraph-image|manifest|.*\\..*).*)"],
};

export function proxy(request) {
  const decision = routeForLanguage({
    pathname: request.nextUrl.pathname,
    savedLang: request.cookies.get("lang")?.value,
    method: request.method,
  });
  if (decision.action === "next") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = decision.path;
  return decision.action === "redirect" ? NextResponse.redirect(url, decision.status) : NextResponse.rewrite(url);
}
