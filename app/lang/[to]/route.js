// Switches the site language and goes back to the page the reader was on.
import { NextResponse } from "next/server";
import { validLang } from "../../../lib/languages.js";
import { sameSiteTarget } from "../../../lib/safe-redirect.js";

export async function GET(request, { params }) {
  const { to } = await params;
  const lang = validLang(to);
  const back = request.nextUrl.searchParams.get("back") || "/";
  // Only go back to pages on this site (see lib/safe-redirect.js).
  const res = NextResponse.redirect(sameSiteTarget(back, request.url));
  res.cookies.set("lang", lang, { path: "/", maxAge: 365 * 86400, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
