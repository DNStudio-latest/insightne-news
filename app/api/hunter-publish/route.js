// Publishes one News Hunter draft without the editor, when it passes every rule in lib/hunter/auto.js.
// Called by the Hunter on GitHub (lib/hunter/auto.js createPublisher). Only the Hunter can call it: it must show
// the password made from the Supabase secret key. Every story published this way is sent to the editor's Telegram.
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import hunterConfig from "../../../hunter.json";
import { db } from "../../../lib/db.js";
import { settings } from "../../../lib/config.js";
import { refreshSite } from "../../../lib/site-cache.js";
import { hunterStore } from "../../../lib/hunter/store.js";
import { publishHunterDraft } from "../../../lib/hunter/publish.js";
import { autoPublishCheck, safeShot, publishToken } from "../../../lib/hunter/auto.js";
import { createTelegramAlert } from "../../../lib/hunter/alert.js";
import { finishPublishing } from "../../../lib/after-publish.js";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const indiaDay = (date) => new Date(date).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const refreshPages = () => {
  revalidatePath("/", "layout");
  refreshSite();
};

export async function POST(request) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret || request.headers.get("authorization") !== `Bearer ${publishToken(secret)}`) return Response.json({ reason: "Not allowed" }, { status: 403 });
  const { draft: draftId } = await request.json().catch(() => ({}));
  const draft = draftId ? await hunterStore.getDraft(String(draftId).slice(0, 60)) : null;
  if (!draft || draft.status !== "pending") return Response.json({ published: false, reason: "draft not found or already handled" });

  const rules = hunterConfig.autoPublish || {};
  const check = autoPublishCheck(draft, rules);
  if (!check.ok) return Response.json({ published: false, reason: check.reason });
  const today = indiaDay(Date.now());
  const recent = await db.listStories({ status: "approved", limit: 200 });
  const doneToday = recent.filter((s) => s.auto_published && s.published_at && indiaDay(s.published_at) === today).length;
  if (doneToday >= (rules.perDay ?? 10)) return Response.json({ published: false, reason: `daily limit of ${rules.perDay ?? 10} reached` });

  const storyId = await publishHunterDraft({ db, hunterStore, draft, shot: safeShot(draft), auto: true });
  const story = await db.getStory(storyId);
  const url = `${settings.siteUrl}/story/${story.slug}`;
  refreshPages();
  after(() => finishPublishing(db, storyId, refreshPages));
  const alert = createTelegramAlert({ token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID });
  if (alert) await alert({ label: "📰 AUTO-PUBLISHED", title: draft.headline, state: draft.state, source: draft.sources[0]?.name || "official source", url }).catch(() => {});
  return Response.json({ published: true, url });
}
