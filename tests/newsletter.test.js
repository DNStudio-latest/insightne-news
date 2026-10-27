import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanEmail, dailyEmail, confirmEmail, sendEmail, newToken } from "../lib/newsletter.js";

test("cleanEmail accepts real addresses and rejects junk", () => {
  assert.equal(cleanEmail("  Reader@Example.COM "), "reader@example.com");
  assert.equal(cleanEmail("not-an-email"), null);
  assert.equal(cleanEmail("a@b"), null);
  assert.equal(cleanEmail('x"<script>@evil.com'), null);
});

test("daily email uses Bengali when chosen, escapes text and has an unsubscribe link", () => {
  const stories = [{ slug: "a-1", region: "Tripura", headline: "Roads <b>open</b>", summary: "S", headline_bn: "রাস্তা খুলল", summary_bn: "স" }];
  const en = dailyEmail(stories, { lang: "en", token: "t0k", day: "Monday" });
  assert.match(en.html, /Roads &lt;b&gt;open&lt;\/b&gt;/);
  assert.match(en.html, /newsletter\?unsubscribe=t0k/);
  assert.match(dailyEmail(stories, { lang: "bn", token: "t", day: "x" }).subject, /রাস্তা খুলল/);
  assert.match(confirmEmail("abc", "en").html, /newsletter\?confirm=abc/);
  assert.equal(newToken().length, 48);
});

test("sendEmail sends the right request to Brevo", async () => {
  process.env.BREVO_API_KEY = "test-key";
  process.env.NEWSLETTER_FROM = "news@example.com";
  const realFetch = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, options) => ((seen = { url, options }), new Response("{}", { status: 201 }));
  try {
    await sendEmail({ to: "r@example.com", subject: "Hi", html: "<p>x</p>", text: "x", unsubscribe: "tok" });
  } finally {
    globalThis.fetch = realFetch;
  }
  const body = JSON.parse(seen.options.body);
  assert.equal(seen.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(seen.options.headers["api-key"], "test-key");
  assert.deepEqual(body.to, [{ email: "r@example.com" }]);
  assert.equal(body.sender.email, "news@example.com");
  assert.match(body.headers["List-Unsubscribe"], /unsubscribe\?t=tok/);
});
