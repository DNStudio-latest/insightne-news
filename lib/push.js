// Breaking-news alerts on readers' phones (free "web push", built into Chrome, Edge, Firefox and Safari).
// Needs two secret settings: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY (made once with `npm run alert-keys`).
import webpush from "web-push";
import { settings } from "./config.js";
import { storyText } from "./languages.js";

export const pushPublicKey = () => process.env.VAPID_PUBLIC_KEY || "";
export const pushReady = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// Sends one message to every subscriber, in their language. Phones that unsubscribed are removed.
export async function sendAlert(db, { story, url }) {
  if (!pushReady()) throw new Error("Phone alerts are not set up yet (VAPID keys are missing).");
  webpush.setVapidDetails(settings.siteUrl, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
  const subs = await db.listPushSubscriptions();
  let sent = 0;
  for (let i = 0; i < subs.length; i += 50) {
    await Promise.all(
      subs.slice(i, i + 50).map(async (sub) => {
        const body = storyText(story, "headline", sub.lang);
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, JSON.stringify({ title: settings.siteName, body, url }), { TTL: 6 * 3600, urgency: "high" });
          sent++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) await db.deletePushSubscription(sub.endpoint).catch(() => {});
        }
      }),
    );
  }
  return { sent, total: subs.length };
}
