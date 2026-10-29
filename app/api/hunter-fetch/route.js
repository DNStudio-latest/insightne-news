// Fetches one government page for the News Hunter running on GitHub (see lib/hunter/relay.js).
// This server is in Mumbai, so government websites that refuse foreign visitors answer it.
// Only the Hunter can use it (it must show the password made from the Supabase secret key),
// and only *.gov.in and *.nic.in pages can be fetched.
import { relayAllowed, relayToken } from "../../../lib/hunter/relay.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || request.headers.get("authorization") !== `Bearer ${relayToken(secret)}`) return new Response("Not allowed", { status: 403 });
  const url = new URL(request.url).searchParams.get("url");
  if (!relayAllowed(url)) return new Response("Only government pages", { status: 400 });

  let asked = {};
  try {
    asked = JSON.parse(request.headers.get("x-forward-headers") || "{}");
  } catch {}
  const headers = {};
  for (const name of ["User-Agent", "Accept-Language"]) if (asked[name]) headers[name] = String(asked[name]);

  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(50000), cache: "no-store" });
    if (!relayAllowed(res.url || url)) return new Response(null, { headers: { "x-relay-error": "redirected away from a government site" } });
    const out = new Headers({ "x-relay-status": String(res.status), "x-relay-url": res.url || url, "Cache-Control": "no-store" });
    if (res.headers.get("content-type")) out.set("content-type", res.headers.get("content-type"));
    return new Response(res.body, { headers: out });
  } catch (err) {
    return new Response(null, { headers: { "x-relay-error": `fetch failed in Mumbai: ${err.cause?.code || err.message}`.slice(0, 200) } });
  }
}
