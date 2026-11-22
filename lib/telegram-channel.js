// Posts a published story to your public Telegram channel: the news poster (or a plain link) with headline, summary and hashtags.
// Needs TELEGRAM_BOT_TOKEN (the alert bot) and TELEGRAM_CHANNEL (the channel's @username, e.g. @insightne_news).
// The bot must be an administrator of the channel with permission to post messages.
import { settings } from "./config.js";
import { hashtags, usePoster, posterUrl } from "./facebook.js";
import { readSocialLog } from "./social.js";

const API = "https://api.telegram.org";
const MAX_CAPTION = 1000; // Telegram allows 1024 characters under a picture

export const telegramChannelReady = () => Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHANNEL);
// autoPost in settings.json "telegramChannel": "originals" = only your own reports, true = every published story, false = off.
export function telegramChannelAutoPost(story) {
  const mode = settings.telegramChannel?.autoPost;
  if (!telegramChannelReady() || story?.status !== "approved") return false;
  return mode === true || (mode === "originals" && story.kind === "original");
}

const storyLink = (story) => new URL(`/story/${story.slug}`, settings.siteUrl).toString();
const channel = () => {
  const c = String(process.env.TELEGRAM_CHANNEL || "").trim();
  return c.startsWith("@") || /^-?\d+$/.test(c) ? c : `@${c}`;
};

export function telegramChannelText(story) {
  const head = [story.headline, "", story.summary].join("\n").trim();
  const tail = `\n\n🔗 ${storyLink(story)}\n${hashtags(story)}`;
  const room = MAX_CAPTION - tail.length;
  const body = [...head].length > room ? `${[...head].slice(0, Math.max(0, room - 1)).join("").trim()}…` : head;
  return `${body}${tail}`;
}

async function call(method, payload, fetchFn) {
  const res = await fetchFn(`${API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(`Telegram said: ${data.description || res.status}`);
  return data.result;
}

// Returns the channel message number.
export async function postToTelegramChannel(story, { fetchFn = fetch } = {}) {
  if (!telegramChannelReady()) throw new Error("The Telegram channel is not set up yet (TELEGRAM_CHANNEL is missing).");
  const chat_id = channel();
  const text = telegramChannelText(story);
  if (usePoster(story)) {
    try {
      return (await call("sendPhoto", { chat_id, photo: posterUrl(story, "landscape"), caption: text }, fetchFn)).message_id;
    } catch (err) {
      console.error("Telegram poster failed, sending the link instead:", err.message); // the story is still shared
    }
  }
  return (await call("sendMessage", { chat_id, text }, fetchFn)).message_id;
}

// True when this story already has a successful Telegram channel post in the social log.
export async function alreadyOnTelegramChannel(db, story) {
  const log = await readSocialLog(db).catch(() => []);
  return log.some((e) => e.network === "Telegram" && !e.error && e.slug === story.slug);
}
