import { test } from "node:test";
import assert from "node:assert/strict";
import { canIllustrate, illustrationPrompt, generateIllustration, AI_CREDIT } from "../lib/images.js";

test("AI illustrations: never for sensitive stories or stories with your own photo", () => {
  assert.equal(canIllustrate({ headline: "New college building opens in Udaipur", summary: "", check_reasons: [] }), true);
  assert.equal(canIllustrate({ headline: "Two killed in road accident on NH8", summary: "", check_reasons: [] }), false);
  assert.equal(canIllustrate({ headline: "Man arrested for theft", summary: "", check_reasons: [] }), false);
  assert.equal(canIllustrate({ headline: "Temple festival begins", summary: "", check_reasons: ["Mentions religion or community"] }), false);
  assert.equal(canIllustrate({ headline: "Football final today", image_url: "https://x/y.jpg", check_reasons: [] }), false);
});

test("AI illustrations: drawn style, no people or text, and the right request", async () => {
  const p = illustrationPrompt({ headline: "Heavy rain lashes Agartala", region: "Tripura" });
  assert.match(p, /flat vector/);
  assert.match(p, /No text/);
  assert.match(p, /no recognizable or realistic people/);
  assert.match(p, /Tripura, Northeast India/);
  let sent;
  const fetchFn = async (url, opts) => {
    sent = { url, opts };
    return { ok: true, json: async () => ({ success: true, result: { image: Buffer.from("fakejpeg").toString("base64") } }) };
  };
  const bytes = await generateIllustration({ headline: "x", region: "World" }, { env: { CLOUDFLARE_ACCOUNT_ID: "acc", CLOUDFLARE_API_TOKEN: "tok" }, fetchFn });
  assert.equal(Buffer.from(bytes).toString(), "fakejpeg");
  assert.match(sent.url, /accounts\/acc\/ai\/run\/@cf\/black-forest-labs\/flux-1-schnell/);
  assert.equal(sent.opts.headers.Authorization, "Bearer tok");
  assert.equal(AI_CREDIT, "AI-generated illustration");
});
