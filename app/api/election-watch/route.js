// Runs the election watcher (lib/hunter/watch.js). Started every 15 minutes by the Supabase timer
// (supabase/election-watch.sql). Only the timer can start it: it must show the password made from the Supabase secret key.
import hunterConfig from "../../../hunter.json";
import { hunterStore } from "../../../lib/hunter/store.js";
import { createPoliteFetcher } from "../../../lib/hunter/polite.js";
import { createTelegramAlert } from "../../../lib/hunter/alert.js";
import { watchElections, watchToken } from "../../../lib/hunter/watch.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || request.headers.get("authorization") !== `Bearer ${watchToken(secret)}`) return new Response("Not allowed", { status: 403 });
  const alert = createTelegramAlert({ token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID });
  const result = await watchElections({ store: hunterStore, get: createPoliteFetcher({ log: () => {} }), config: hunterConfig, alert, log: () => {} });
  return Response.json({ ...result, alerts_on: Boolean(alert) }, { headers: { "Cache-Control": "no-store" } });
}
