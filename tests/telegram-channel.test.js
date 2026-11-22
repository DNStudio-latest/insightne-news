import test from "node:test";
import assert from "node:assert/strict";
import { telegramChannelText, postToTelegramChannel, telegramChannelAutoPost } from "../lib/telegram-channel.js";

const story = { status: "approved", kind: "original", slug: "a-story-abc123", headline: "Tripura minister opens a new bridge", summary: "A short summary of the story.", region: "Tripura", topic: "Infrastructure" };

test("the caption fits Telegram's limit and ends with the link and hashtags", () => {
  const text = telegramChannelText({ ...story, summary: "word ".repeat(600) });
  assert.ok([...text].length <= 1024);
  assert.match(text, /\/story\/a-story-abc123/);
  assert.match(text, /#Tripura/);
});

test("sends a message to the channel and returns the message number", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123:test";
  process.env.TELEGRAM_CHANNEL = "insightne_news";
  const calls = [];
  const fetchFn = async (url, opts) => {
    calls.push({ url: String(url), body: JSON.parse(opts.body) });
    return Response.json({ ok: true, result: { message_id: 77 } });
  };
  const id = await postToTelegramChannel(story, { fetchFn });
  assert.equal(id, 77);
  assert.equal(calls.at(-1).body.chat_id, "@insightne_news");
  assert.match(calls.at(-1).url, /bot123:test\/(sendMessage|sendPhoto)$/);
});

test("a Telegram error is reported in plain words", async () => {
  process.env.TELEGRAM_BOT_TOKEN = "123:test";
  process.env.TELEGRAM_CHANNEL = "@x";
  const fetchFn = async () => Response.json({ ok: false, description: "Forbidden: bot is not a member of the channel chat" }, { status: 403 });
  await assert.rejects(() => postToTelegramChannel(story, { fetchFn }), /bot is not a member/);
});

test("auto-post needs the channel setting and a published story", () => {
  process.env.TELEGRAM_BOT_TOKEN = "123:test";
  process.env.TELEGRAM_CHANNEL = "@x";
  assert.equal(telegramChannelAutoPost(story), true);
  assert.equal(telegramChannelAutoPost({ ...story, status: "pending" }), false);
  delete process.env.TELEGRAM_CHANNEL;
  assert.equal(telegramChannelAutoPost(story), false);
});
