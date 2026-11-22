// Starts "CONNECT THREADS" (admin only): sends you to Threads to approve the website, with a one-time check code.
import { randomBytes } from "node:crypto";
import { currentRole } from "../../../../lib/auth.js";
import { threadsAppReady, threadsAuthorizeUrl } from "../../../../lib/threads.js";

export const dynamic = "force-dynamic";

export async function GET() {
  if ((await currentRole()) !== "admin") return new Response("Not allowed", { status: 403 });
  if (!threadsAppReady()) return new Response("THREADS_APP_ID and THREADS_APP_SECRET are missing in the server file.", { status: 400 });
  const state = randomBytes(16).toString("hex");
  return new Response(null, {
    status: 302,
    headers: {
      Location: threadsAuthorizeUrl(state),
      "Set-Cookie": `threads_state=${state}; Path=/api/threads; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      "Cache-Control": "no-store",
    },
  });
}
