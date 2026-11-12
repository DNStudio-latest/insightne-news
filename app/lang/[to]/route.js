// Switches the site language: sends the reader to the same page in the chosen language (Bengali pages live under /bn/,
// English at the plain address) and remembers the choice, so a returning reader of another language is taken
// to that language's address.
import { NextResponse } from "next/server";
import { validLang, langPath, splitLangPath } from "../../../lib/languages.js";
import { sameSiteTarget } from "../../../lib/safe-redirect.js";

export async function GET(request, { params }) {
  const { to } = await params;
  const lang = validLang(to);
  const back = request.nextUrl.searchParams.get("back") || "/";
  // Only go back to pages on this site (see lib/safe-redirect.js), then put the chosen language in front.
  const safe = new URL(sameSiteTarget(back, request.url));
  const { path } = splitLangPath(safe.pathname);
  safe.pathname = langPath(lang, path);
  const res = NextResponse.redirect(safe);
  res.cookies.set("lang", lang, { path: "/", maxAge: 365 * 86400, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
