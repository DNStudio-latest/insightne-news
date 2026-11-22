// Where Threads sends you back after you approve (admin only): checks the code, saves the token, returns to /admin/social.
import { currentRole } from "../../../../lib/auth.js";
import { db } from "../../../../lib/db.js";
import { connectThreads } from "../../../../lib/threads.js";

export const dynamic = "force-dynamic";

const back = (query) => new Response(null, { status: 302, headers: { Location: `/admin/social?${query}`, "Cache-Control": "no-store", "Set-Cookie": "threads_state=; Path=/api/threads; Max-Age=0" } });

export async function GET(request) {
  if ((await currentRole()) !== "admin") return new Response("Not allowed", { status: 403 });
  const url = new URL(request.url);
  const code = (url.searchParams.get("code") || "").replace(/#_$/, "");
  const state = url.searchParams.get("state") || "";
  const cookie = /(?:^|;\s*)threads_state=([a-f0-9]+)/.exec(request.headers.get("cookie") || "")?.[1];
  if (url.searchParams.get("error")) return back(`threads=${encodeURIComponent(url.searchParams.get("error_description") || url.searchParams.get("error"))}`);
  if (!code || !state || state !== cookie) return back("threads=The+check+code+did+not+match.+Start+again+with+CONNECT+THREADS.");
  try {
    await connectThreads(db, code);
    return back("threads=connected");
  } catch (err) {
    return back(`threads=${encodeURIComponent(err.message)}`);
  }
}
