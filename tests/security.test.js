import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { isPrivateAddress, assertPublicUrl, safeFetch } from "../lib/safe-fetch.js";
import { isPushServiceUrl } from "../lib/push-hosts.js";
import { sameSecret, hasBearer } from "../lib/tokens.js";
import { base32Decode, base32Encode, totpCode, verifyTotp } from "../lib/totp.js";
import { rateLimit, clientIp } from "../lib/rate-limit.js";
import { sniffImage, compressPhoto, PhotoError } from "../lib/photo.js";
import { sameSiteTarget } from "../lib/safe-redirect.js";

// ---- SSRF: private network addresses are never fetched ----
test("private, local and cloud-internal addresses are recognised", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "1.1.1.1", "13.235.1.1", "172.32.0.1", "2606:4700:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
});

test("a web address is refused when it points inside, uses odd ports, or hides a password", async () => {
  const lookup = async (host) => (host === "evil.example" ? [{ address: "169.254.169.254" }] : [{ address: "93.184.216.34" }]);
  await assert.rejects(assertPublicUrl("http://169.254.169.254/latest/meta-data", { lookup }), /private/);
  await assert.rejects(assertPublicUrl("http://localhost/admin", { lookup }), /private/);
  await assert.rejects(assertPublicUrl("https://evil.example/", { lookup }), /private/, "a name that points to a private address");
  await assert.rejects(assertPublicUrl("https://example.com:8443/", { lookup }), /port/);
  await assert.rejects(assertPublicUrl("file:///etc/passwd", { lookup }), /http/);
  await assert.rejects(assertPublicUrl("https://user:pw@example.com/", { lookup }), /user name/);
  assert.equal((await assertPublicUrl("https://example.com/news", { lookup })).hostname, "example.com");
});

test("a redirect to a private address is stopped; normal redirects are followed", async () => {
  const lookup = async (host) => (host === "evil.example" ? [{ address: "10.0.0.5" }] : [{ address: "93.184.216.34" }]);
  const redirecting = (to) => async (url) => (url === "https://news.example/a" ? new Response(null, { status: 302, headers: { location: to } }) : new Response("page", { status: 200 }));
  await assert.rejects(safeFetch("https://news.example/a", {}, { fetchFn: redirecting("http://169.254.169.254/x"), lookup }), /private/);
  await assert.rejects(safeFetch("https://news.example/a", {}, { fetchFn: redirecting("https://evil.example/x"), lookup }), /private/);
  assert.equal(await (await safeFetch("https://news.example/a", {}, { fetchFn: redirecting("/b"), lookup })).text(), "page");
  // a restriction such as "government sites only" also applies to every redirect
  await assert.rejects(safeFetch("https://x.gov.in/a", {}, { allow: (u) => new URL(u).hostname.endsWith(".gov.in"), fetchFn: async () => new Response(null, { status: 302, headers: { location: "https://other.example/" } }), lookup }), /not allowed/);
  // an endless chain of redirects ends
  await assert.rejects(safeFetch("https://news.example/a", {}, { fetchFn: async () => new Response(null, { status: 302, headers: { location: "https://news.example/a" } }), lookup }), /too many redirects/);
});

// ---- phone alerts only go to the browser makers' push services ----
test("only real push services are accepted", () => {
  for (const ok of ["https://fcm.googleapis.com/fcm/send/abc", "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://web.push.apple.com/abc", "https://par02p.notify.windows.com/w/?token=abc"]) assert.equal(isPushServiceUrl(ok), true, ok);
  for (const bad of ["https://evil.example/push", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.example/x", "https://169.254.169.254/", "https://user@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "javascript:alert(1)", ""]) assert.equal(isPushServiceUrl(bad), false, bad);
});

// ---- the Hunter's password is compared safely ----
test("bearer passwords: only the exact one is accepted", () => {
  const req = (value) => ({ headers: new Headers(value ? { authorization: value } : {}) });
  assert.equal(hasBearer(req("Bearer abc123"), "abc123"), true);
  assert.equal(hasBearer(req("Bearer abc124"), "abc123"), false);
  assert.equal(hasBearer(req("abc123"), "abc123"), false);
  assert.equal(hasBearer(req(null), "abc123"), false);
  assert.equal(hasBearer(req("Bearer "), ""), false, "no secret set means nobody gets in");
  assert.equal(sameSecret("a", "a"), true);
  assert.equal(sameSecret("a", "b"), false);
});

// ---- two-step sign-in: the published test values of the standard (RFC 6238, SHA-1) ----
test("two-step codes match the standard's test values", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  assert.equal(secret, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
  assert.equal(base32Decode(secret).toString(), "12345678901234567890");
  assert.equal(totpCode(secret, Math.floor(59 / 30)), "287082");
  assert.equal(totpCode(secret, Math.floor(1111111109 / 30)), "081804");
  assert.equal(totpCode(secret, Math.floor(1111111111 / 30)), "050471");
  assert.equal(totpCode(secret, Math.floor(20000000000 / 30)), "353130");
});

test("a code works once, wrong or old codes do not, and an old code is refused", () => {
  const secret = base32Encode(Buffer.from("12345678901234567890"));
  const t = 1111111109 * 1000;
  assert.equal(verifyTotp(secret, "000000", t), false);
  assert.equal(verifyTotp(secret, "12345", t), false);
  assert.equal(verifyTotp(secret, "", t), false);
  assert.equal(verifyTotp(secret, "081 804", t), true, "spaces are ignored");
  assert.equal(verifyTotp(secret, "081804", t), false, "the same code cannot be used twice");
  assert.equal(verifyTotp(secret, "050471", t + 90000), false, "a code more than one step old");
  assert.equal(verifyTotp(secret, "050471", t + 30000), true, "the next step is accepted");
  assert.equal(verifyTotp("", "050471", t), false);
});

// ---- rate limits ----
test("the limiter blocks after the limit, per key, and falls back to memory when the database is not ready", async () => {
  const hit = async () => { throw new Error("rate_limits table missing"); };
  const run = (key, limit = 3) => rateLimit({ key, limit, windowSec: 60, hit, now: 1_000_000 });
  assert.deepEqual([(await run("k1")).ok, (await run("k1")).ok, (await run("k1")).ok, (await run("k1")).ok], [true, true, true, false]);
  assert.equal((await run("k2")).ok, true, "another key has its own count");
  assert.equal((await rateLimit({ key: "k1", limit: 3, windowSec: 60, hit, now: 1_000_000 + 61_000 })).ok, true, "a new window starts");
});

test("the limiter uses the shared database count when it is there", async () => {
  const counts = [1, 2, 11];
  const hit = async () => counts.shift();
  const results = [];
  for (let i = 0; i < 3; i++) results.push((await rateLimit({ key: "login:1.2.3.4", limit: 10, windowSec: 900, hit })).ok);
  assert.deepEqual(results, [true, true, false]);
});

test("the visitor's address comes from the hosting service's headers", () => {
  assert.equal(clientIp(new Headers({ "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" })), "1.2.3.4");
  assert.equal(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" })), "5.6.7.8");
  assert.equal(clientIp(new Headers()), "unknown");
});

// ---- uploads: only real photos ----
test("files are recognised by what they are, not by what they claim", async () => {
  const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#c33" } }).png().toBuffer();
  const jpg = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#c33" } }).jpeg().toBuffer();
  const webp = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#c33" } }).webp().toBuffer();
  assert.deepEqual([sniffImage(png), sniffImage(jpg), sniffImage(webp)], ["image/png", "image/jpeg", "image/webp"]);
  for (const fake of ["<html><script>alert(1)</script></html>", '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "MZ\x90\x00\x03\x00\x00\x00 an exe file", "#!/bin/sh\nrm -rf /", ""]) {
    assert.equal(sniffImage(new TextEncoder().encode(fake)), null, fake.slice(0, 20));
    await assert.rejects(compressPhoto(new TextEncoder().encode(fake)), PhotoError);
  }
  const out = await compressPhoto(new Uint8Array(png));
  assert.equal(out.contentType, "image/webp");
  assert.equal(sniffImage(out.bytes), "image/webp");
  // a PNG header followed by rubbish is not stored either
  const broken = new Uint8Array([...png.subarray(0, 24), ...new Uint8Array(40)]);
  await assert.rejects(compressPhoto(broken), PhotoError);
});

// ---- the language link can no longer send visitors to another website ----
test("the language switch only goes back to pages of this site", async () => {
  const go = async (back) => sameSiteTarget(back, "https://www.insightnenews.in/lang/bn").href;
  for (const evil of ["/\\evil.com", "/\\/evil.com", "//evil.com", "https://evil.com", "/\t/evil.com", "/\n/evil.com", "javascript:alert(1)", "evil.com"]) {
    assert.equal(await go(evil), "https://www.insightnenews.in/", JSON.stringify(evil));
  }
  assert.equal(await go("/story/a-b-c?x=1"), "https://www.insightnenews.in/story/a-b-c?x=1");
  assert.equal(await go("/"), "https://www.insightnenews.in/");
});
