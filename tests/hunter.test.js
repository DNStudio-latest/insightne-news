import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDraft, hasCheckMarks } from "../lib/hunter/checks.js";
import { parseRobots, robotsAllows } from "../lib/hunter/polite.js";
import { extractLinks, looksLikeItem, findDate, dateFromLink, readItemPage } from "../lib/hunter/pages.js";
import { readability } from "../lib/hunter/pdf.js";
import { createLocalHunterStore } from "../lib/hunter/store.js";
import { runHunter } from "../lib/hunter/run.js";
import os from "node:os";
import path from "node:path";

const SOURCE = `The Chief Minister said, “We will open 25 new schools in Dhalai district by March 2027.”
A sum of Rs 1,250 crore has been sanctioned. মুখ্যমন্ত্রী বলেন, “আমরা কাজ শুরু করেছি।” Date: ২৮/১০/২০২৬`;

test("quotes copied word for word pass; changed quotes get [CHECK]", () => {
  const ok = checkDraft("He said, “We will open 25 new schools in Dhalai district by March 2027.”", [SOURCE]);
  assert.deepEqual(ok.problems, []);
  const changed = checkDraft("He said, “We will build 25 new schools in Dhalai district.”", [SOURCE]);
  assert.match(changed.text, /\[CHECK: quote not found word for word in the source\]/);
  const bengali = checkDraft("He said “আমরা কাজ শুরু করেছি।” (translated: We have started the work.)", [SOURCE]);
  assert.deepEqual(bengali.problems, [], "a quote in Bengali, exactly as in the source, passes");
});

test("numbers not in the source get [CHECK]; Bengali digits and commas count", () => {
  const out = checkDraft("Rs 1,250 crore for 25 schools; 30 teachers; dated 28/10/2026.", [SOURCE]);
  assert.match(out.text, /30 \[CHECK\] teachers/);
  assert.doesNotMatch(out.text, /1,250 \[CHECK\]|25 \[CHECK\]|28 \[CHECK\]/);
  assert.equal(out.problems.length, 1);
  assert.ok(hasCheckMarks(out.text));
  assert.ok(!hasCheckMarks("A clean story."));
});

test("robots.txt rules are obeyed", () => {
  const rules = parseRobots("User-agent: *\nDisallow: /admin/\nAllow: /admin/press\n\nUser-agent: OtherBot\nDisallow: /");
  assert.equal(robotsAllows(rules, "/press-release"), true);
  assert.equal(robotsAllows(rules, "/admin/users"), false);
  assert.equal(robotsAllows(rules, "/admin/press/1"), true, "the longer Allow rule wins");
  assert.equal(robotsAllows(parseRobots("User-agent: *\nDisallow: /"), "/anything"), false);
  assert.equal(robotsAllows(parseRobots("User-agent: InsightNE-NewsBot\nDisallow: /\nUser-agent: *\nDisallow:"), "/x"), false, "our own section is used first");
});

test("menu links are ignored; press releases and PDFs are kept", () => {
  const html = `<nav><a href="/about-us">About us</a><a href="/press-release/cm-visits-dhalai-hospital-2026">x</a></nav>
    <div class="view-content"><a href="/press-release/cm-inaugurates-new-hospital-at-ambassa-2026">CM inaugurates new hospital at Ambassa</a>
    <a href="/sites/default/files/2026-10/Notification%20LDC.pdf">Notification for LDC</a>
    <a href="/contact-us">Contact us</a><a href="https://www.facebook.com/x">Facebook</a></div>`;
  const page = "https://ica.tripura.gov.in/press-release";
  const items = extractLinks(html, page).filter((l) => looksLikeItem(l, page)).map((l) => l.url);
  assert.deepEqual(items, ["https://ica.tripura.gov.in/press-release/cm-inaugurates-new-hospital-at-ambassa-2026", "https://ica.tripura.gov.in/sites/default/files/2026-10/Notification%20LDC.pdf"]);
});

test("dates are read from text and from link names", () => {
  assert.equal(findDate("Agartala, 29 October 2026: The"), "2026-10-29T06:30:00.000Z");
  assert.equal(findDate("Posted on October 28, 2026"), "2026-10-28T06:30:00.000Z");
  assert.equal(findDate("Dated 27.10.2026"), "2026-10-27T06:30:00.000Z");
  assert.equal(dateFromLink({ url: "https://x.gov.in/files/E-Sambad%20Master%20Copy-18-Nov-2022.pdf", text: "e-Sambad" }), "2022-11-18T06:30:00.000Z");
  assert.equal(dateFromLink({ url: "https://x.gov.in/sites/default/files/2026-10/speech.pdf", text: "Speech" }), "2026-10-31T06:30:00.000Z", "a month folder counts as the month's end");
});

test("item pages give their title, date, text and attached PDF", () => {
  const page = readItemPage(`<html><head><title>Site</title></head><body><header>Menu</header><h1>Governor visits Unakoti</h1>
    <div class="field--name-body"><p>Agartala, 28 October 2026</p><p>The Governor visited Unakoti on Tuesday.</p><a href="/files/pr.pdf">Download</a></div><footer>Copyright</footer></body></html>`, "https://lokbhavan.tripura.gov.in/press/1");
  assert.equal(page.title, "Governor visits Unakoti");
  assert.equal(page.published, "2026-10-28T06:30:00.000Z");
  assert.match(page.text, /The Governor visited Unakoti on Tuesday\./);
  assert.doesNotMatch(page.text, /Copyright|Menu/);
  assert.equal(page.documents[0].url, "https://lokbhavan.tripura.gov.in/files/pr.pdf");
});

test("text from old Bengali fonts counts as unreadable, so OCR is used", () => {
  assert.ok(readability("The Chief Minister inaugurated a new hospital at Ambassa on Tuesday, according to the press release issued today.") > 0.8);
  assert.ok(readability("মুখ্যমন্ত্রী আজ আমবাসায় নতুন হাসপাতালের উদ্বোধন করেন। এই হাসপাতালে একশো শয্যা থাকবে বলে জানানো হয়েছে।") > 0.8);
  assert.ok(readability("ÒÎ¸ê¦ýÂ ÖÇ¸ê¦ý ÒÎ¸ê ¦ýÂÖÇ¸ ê¦ýÒÎ¸ ê¦ýÂÖ Ç¸ê¦ýÒ Î¸ê¦ýÂ ÖÇ¸ê¦ý ÒÎ¸ê¦ýÂ ÖÇ¸ê¦ý ÒÎ¸ê¦ýÂÖÇ¸ê¦ý ÒÎ¸ê¦ýÂÖÇ ¸ê¦ýÒÎ¸ê¦ýÂÖÇ¸ê¦ý") < 0.2);
});

test("a full run: new item read once, judged, drafted with checks; nothing published; no item read twice", async () => {
  const store = createLocalHunterStore(path.join(os.tmpdir(), `hunter-test-${Date.now()}.json`));
  const list = (links) => `<html><body><div class="content">${links}</div></body></html>`;
  const pages = {
    "https://lokbhavan.tripura.gov.in/press-release": list('<a href="/press-release/governor-meets-students-of-tripura-university-2026">Governor meets students of Tripura University</a>'),
    "https://lokbhavan.tripura.gov.in/press-release/governor-meets-students-of-tripura-university-2026": `<html><body><h1>Governor meets students</h1><div class="field--name-body"><p>Agartala, ${new Date().getUTCDate()} ${new Date().toLocaleString("en", { month: "long", timeZone: "UTC" })} ${new Date().getUTCFullYear()}</p><p>The Governor met 120 students of Tripura University at Lok Bhavan and said, “Education is the strongest tool for development.” He asked them to work hard for the state and to take part in social service activities in their villages.</p></div></body></html>`,
  };
  const fetched = [];
  const get = async (url) => (fetched.push(url), pages[url] ? { ok: true, type: "text/html", bytes: Buffer.from(pages[url]), text: pages[url], url } : { ok: false, reason: "HTTP 404" });
  const ai = {
    judge: async (items) => new Map(items.map((i) => [i.id, { id: i.id, newsworthy: true, score: 7, routine: false, state: "Tripura", language: "en", event: "Governor meets students", same_as: null, reason: "Governor activity" }])),
    draft: async () => ({ headline: "Governor meets 120 students of Tripura University", paragraphs: ["Governor met 120 students at Lok Bhavan, according to a press release.", "He said, “Education is the strongest tool for development.”", "He also met 40 teachers."], attribution: "This is according to a press release from Lok Bhavan Tripura.", state: "Tripura", topic: null }),
  };
  const config = { sites: [{ enabled: true, state: "Tripura", name: "Lok Bhavan Tripura", pages: ["https://lokbhavan.tripura.gov.in/press-release"] }], youtube: [] };
  const run = await runHunter({ store, get, ai, config, fetchFn: async () => new Response("{}"), log: () => {} });
  assert.equal(run.drafts_created, 1);
  const [draft] = await store.listDrafts({ status: "pending" });
  assert.equal(draft.status, "pending", "drafts wait for approval");
  assert.match(draft.body, /40 \[CHECK\] teachers/, "a number that is not in the source is marked");
  assert.doesNotMatch(draft.body, /120 \[CHECK\]/);
  assert.equal(draft.sources[0].url, "https://lokbhavan.tripura.gov.in/press-release/governor-meets-students-of-tripura-university-2026");

  const second = await runHunter({ store, get, ai, config, fetchFn: async () => new Response("{}"), log: () => {} });
  assert.equal(second.drafts_created, 0, "the same item is never processed twice");
  assert.equal(fetched.filter((u) => u.includes("governor-meets")).length, 1);
});

test("on GitHub, government pages go through the website's Mumbai server; only with the right password", async () => {
  const { createRelayFetch, relayAllowed } = await import("../lib/hunter/relay.js");
  process.env.SUPABASE_SECRET_KEY = "test-secret";
  const { GET } = await import("../app/api/hunter-fetch/route.js");
  const upstream = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    upstream.push({ url, ua: init.headers["User-Agent"] });
    return Object.defineProperty(new Response("<p>press release</p>", { status: 200, headers: { "content-type": "text/html" } }), "url", { value: url });
  };
  try {
    const viaRoute = (url, init) => GET(new Request(url, { headers: init.headers }));
    const relayFetch = createRelayFetch({ relayUrl: "https://site.test/api/hunter-fetch", secret: "test-secret", fetchFn: (url, init) => (url.startsWith("https://site.test") ? viaRoute(url, init) : Promise.resolve(new Response("direct"))) });
    const res = await relayFetch("https://ica.tripura.gov.in/press-release", { headers: { "User-Agent": "Bot" } });
    assert.equal(res.status, 200);
    assert.equal(res.url, "https://ica.tripura.gov.in/press-release");
    assert.equal(await res.text(), "<p>press release</p>");
    assert.deepEqual(upstream, [{ url: "https://ica.tripura.gov.in/press-release", ua: "Bot" }]);
    assert.equal(await (await relayFetch("https://www.youtube.com/x")).text(), "direct");
    assert.equal((await GET(new Request("https://site.test/api/hunter-fetch?url=https://ica.tripura.gov.in/"))).status, 403);
    assert.equal(relayAllowed("http://169.254.169.254/latest"), false);
    assert.equal(relayAllowed("https://evil.com/?x=.gov.in"), false);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("dates: the first date written is the publishing date; '10,' in a date is the number 10", () => {
  assert.equal(findDate("Naga News October 27 2026 · Mokokchung. A hearing on 10th November, 2026."), "2026-10-27T06:30:00.000Z");
  const src = "The hearing is on 10th November, 2026. Summary published on 8th October, 2026.\n29 October 2026";
  const ok = checkDraft("The hearing is on November 10, 2026, after a summary on October 8, 2026. Posted on October 29, 2026.", [src]);
  assert.deepEqual(ok.problems, []);
  const bad = checkDraft("The hearing is on November 12, 2026.", [src]);
  assert.equal(bad.text, "The hearing is on November 12 [CHECK], 2026.");
});
