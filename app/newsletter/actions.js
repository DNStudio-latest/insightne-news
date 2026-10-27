"use server";
import { redirect } from "next/navigation";
import { db } from "../../lib/db.js";

const tokenOf = (formData) => {
  const t = String(formData.get("token") || "");
  return /^[0-9a-f]{48}$/.test(t) ? t : null;
};

export async function confirmSubscription(formData) {
  const token = tokenOf(formData);
  const sub = token && (await db.getSubscriber({ token }));
  if (!sub) redirect("/newsletter?done=missing");
  if (!sub.confirmed) await db.updateSubscriber(sub.email, { confirmed: true, confirmed_at: new Date().toISOString() });
  redirect("/newsletter?done=confirmed");
}

export async function unsubscribe(formData) {
  const token = tokenOf(formData);
  const sub = token && (await db.getSubscriber({ token }));
  if (sub) await db.deleteSubscriber(sub.email);
  redirect("/newsletter?done=unsubscribed");
}
