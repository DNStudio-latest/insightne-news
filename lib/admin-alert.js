// A quiet phone alert for the admin only: "a reporter's story is waiting". It carries no name and no headline, so
// nothing private shows on a lock screen. The admin's phone signs up with the button on the approval page; the
// sign-ups are kept in the site setting "admin_push" (separate from the readers' alerts, no new table).
import webpush from "web-push";
import { db } from "./db.js";
import { settings } from "./config.js";
import { pushReady } from "./push.js";
import { isPushServiceUrl } from "./push-hosts.js";

const KEY = "admin_push";
const MAX_DEVICES = 5;

export const ADMIN_ALERT_TEXT = "A reporter's story is waiting for your checking.";

async function load(store) {
  try {
    const v = await store.getSetting(KEY);
    return Array.isArray(v) ? v.filter((s) => s?.endpoint && s?.keys && isPushServiceUrl(s.endpoint)) : [];
  } catch {
    return [];
  }
}

// Adds (or replaces) one device. At most MAX_DEVICES are kept, the newest first.
export async function addAdminDevice(sub, { store = db } = {}) {
  const list = (await load(store)).filter((s) => s.endpoint !== sub.endpoint);
  await store.setSetting(KEY, [{ endpoint: sub.endpoint, keys: sub.keys }, ...list].slice(0, MAX_DEVICES));
}

export async function removeAdminDevice(endpoint, { store = db } = {}) {
  await store.setSetting(KEY, (await load(store)).filter((s) => s.endpoint !== endpoint));
}

// Sends the alert to the admin's phones. Never throws: a failed alert must not stop a reporter from sending a story.
export async function notifyAdmin({ store = db, send = null } = {}) {
  try {
    if (!send && !pushReady()) return 0;
    const subs = await load(store);
    if (!subs.length) return 0;
    const deliver =
      send ||
      ((sub, payload) => {
        webpush.setVapidDetails(settings.siteUrl, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
        return webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 24 * 3600, urgency: "normal" });
      });
    const payload = JSON.stringify({ title: settings.siteName, body: ADMIN_ALERT_TEXT, url: "/admin?view=pending", tag: "admin-pending" });
    let sent = 0;
    const gone = [];
    for (const sub of subs) {
      try {
        await deliver(sub, payload);
        sent++;
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) gone.push(sub.endpoint);
      }
    }
    if (gone.length) await store.setSetting(KEY, subs.filter((s) => !gone.includes(s.endpoint)));
    return sent;
  } catch {
    return 0;
  }
}

// Only a reporter's story sent for approval alerts the admin.
export const shouldAlertAdmin = (role, sentForApproval) => role === "reporter" && Boolean(sentForApproval);
