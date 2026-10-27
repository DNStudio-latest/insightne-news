// Switches the site language (English / বাংলা) and goes back to the page the reader was on.
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { to } = await params;
  const lang = to === "bn" ? "bn" : "en";
  const back = request.nextUrl.searchParams.get("back") || "/";
  // Only go back to pages on this site.
  const target = back.startsWith("/") && !back.startsWith("//") ? back : "/";
  const res = NextResponse.redirect(new URL(target, request.url));
  res.cookies.set("lang", lang, { path: "/", maxAge: 365 * 86400, sameSite: "lax" });
  return res;
}
