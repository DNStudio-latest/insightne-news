// The daily email: sent through Brevo (free for up to 300 emails a day).
// Needs two secret settings: BREVO_API_KEY and NEWSLETTER_FROM (e.g. news@insightnenews.in).
import crypto from "node:crypto";
import { settings } from "./config.js";
import { storyText } from "./languages.js";

export const FREE_DAILY_LIMIT = 300;
export const newsletterReady = () => Boolean(process.env.BREVO_API_KEY && process.env.NEWSLETTER_FROM);
export const newToken = () => crypto.randomBytes(24).toString("hex");
export const cleanEmail = (value) => {
  const email = String(value || "").trim().toLowerCase();
  return email.length <= 200 && /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/.test(email) ? email : null;
};

const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const link = (path) => new URL(path, settings.siteUrl).toString();
export const unsubscribeUrl = (token) => link(`/newsletter?unsubscribe=${token}`);

export async function sendEmail({ to, subject, html, text, unsubscribe }) {
  if (!newsletterReady()) throw new Error("The email newsletter is not set up yet (BREVO_API_KEY or NEWSLETTER_FROM is missing).");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: settings.siteName, email: process.env.NEWSLETTER_FROM },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
      ...(unsubscribe && {
        headers: { "List-Unsubscribe": `<${link(`/api/newsletter/unsubscribe?t=${unsubscribe}`)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Email service said ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

function frame(inner, footer) {
  return `<!doctype html><html><body style="margin:0;background:#f4f2ec;font-family:Arial,Helvetica,sans-serif;color:#1d2124">
<div style="max-width:600px;margin:0 auto;padding:20px 14px">
<div style="font-family:Georgia,serif;font-size:26px;font-weight:bold;margin-bottom:14px">${esc(settings.siteName.split(" ")[0])} <span style="color:#c8553d">${esc(settings.siteName.split(" ").slice(1).join(" "))}</span></div>
<div style="background:#fff;border-radius:10px;padding:20px">${inner}</div>
<p style="font-size:12px;color:#6b6f73;line-height:1.5;margin-top:14px">${footer}</p>
</div></body></html>`;
}

export function confirmEmail(token, lang) {
  const url = link(`/newsletter?confirm=${token}`);
  const bn = lang === "bn";
  const subject = bn ? `${settings.siteName}: ইমেল নিশ্চিত করুন` : `Please confirm your ${settings.siteName} email`;
  const intro = bn
    ? "প্রতিদিনের সেরা ৫টি খবর ইমেলে পেতে নিচের বোতামে চাপুন।"
    : "Tap the button below to start getting the day's top 5 stories from Northeast India by email.";
  const html = frame(
    `<p style="font-size:16px;line-height:1.5;margin:0 0 18px">${esc(intro)}</p>
<a href="${url}" style="display:inline-block;background:#c8553d;color:#fff;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">${bn ? "হ্যাঁ, আমি ইমেল চাই" : "Yes, send me the daily email"}</a>`,
    bn ? "আপনি যদি এটি না চেয়ে থাকেন, এই ইমেলটি উপেক্ষা করুন।" : "If you did not ask for this, simply ignore this email. You will not get any more emails.",
  );
  return { subject, html, text: `${intro}\n\n${url}` };
}

export function dailyEmail(stories, { lang, token, day }) {
  const bn = lang === "bn";
  const pick = (s, f) => storyText(s, f, lang);
  const subject = `${bn ? "আজকের সেরা খবর" : "Top news today"}: ${pick(stories[0], "headline")}`;
  const items = stories
    .map((s, i) => {
      const url = link(`/story/${s.slug}`);
      return `<div style="padding:14px 0;border-top:${i ? "1px solid #e3e1da" : "0"}">
<div style="font-size:11px;font-weight:bold;letter-spacing:1px;color:#c8553d;text-transform:uppercase">${esc(s.region)}</div>
<a href="${url}" style="display:block;font-family:Georgia,serif;font-size:19px;font-weight:bold;color:#1d2124;text-decoration:none;margin:4px 0 6px">${i + 1}. ${esc(pick(s, "headline"))}</a>
<div style="font-size:15px;line-height:1.5;color:#4a4f54">${esc(pick(s, "summary"))}</div>
<a href="${url}" style="font-size:14px;color:#c8553d;font-weight:bold">${bn ? "পুরো খবর পড়ুন →" : "Read more →"}</a></div>`;
    })
    .join("");
  const html = frame(
    `<div style="font-size:13px;color:#6b6f73;margin-bottom:6px">${esc(day)}</div>${items}`,
    `${bn ? "আপনি এই ইমেল পাচ্ছেন কারণ আপনি সাইন আপ করেছেন।" : "You get this email because you signed up on our website."} <a href="${unsubscribeUrl(token)}" style="color:#6b6f73">${bn ? "আর ইমেল চাই না" : "Unsubscribe"}</a> · ${esc(settings.publisher?.address || "")}`,
  );
  const text = [day, "", ...stories.map((s, i) => `${i + 1}. ${pick(s, "headline")}\n${link(`/story/${s.slug}`)}`), "", `Unsubscribe: ${unsubscribeUrl(token)}`].join("\n");
  return { subject, html, text };
}
