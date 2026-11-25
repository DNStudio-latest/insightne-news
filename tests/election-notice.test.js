import { test } from "node:test";
import assert from "node:assert/strict";
import { readItemPage } from "../lib/hunter/pages.js";
import { isElectionNotice } from "../lib/hunter/watch.js";
import { autoPublishCheck } from "../lib/hunter/auto.js";

// Like sec.tripura.gov.in: the notice is only a PDF link, with a long "What's New" list beside it.
const NOTICE = `<html><body><div id="content">
  <h1>Schedule of General Election to the Urban Local Bodies 2026</h1>
  <a href="/sites/default/files/Election%20Notification.pdf">Election Notification.pdf</a>
  <a href="/">Back to previous page</a> | Page Last updated date : 30-10-2026
  <h3>What's New</h3>
  <ul>${Array.from({ length: 8 }, (_, i) => `<li><a href="/notice-${i}">Model Code of Conduct (MCC) in connection with General Election to Urban Local Bodies 2026 number ${i}</a></li>`).join("")}</ul>
</div></body></html>`;

test("a notice page that is only a PDF link is recognised, even with a long list beside it", () => {
  const page = readItemPage(NOTICE, "https://sec.tripura.gov.in/schedule-general-election-urban-local-bodies-2026");
  assert.ok(page.text.length > 400, "the list makes the page look long");
  assert.ok(page.ownLength < 300, `its own words are few (${page.ownLength})`);
  assert.equal(page.documents[0].url, "https://sec.tripura.gov.in/sites/default/files/Election%20Notification.pdf");
});

test("a real press release with an attached PDF keeps its own text", () => {
  const body = "The Chief Minister announced a new scheme for farmers today. ".repeat(10);
  const page = readItemPage(`<html><body><article><h1>New scheme</h1><p>${body}</p><a href="/order.pdf">Order.pdf</a></article></body></html>`, "https://dipr.example.gov.in/news/1");
  assert.ok(page.ownLength >= 300);
});

test("election schedules, press notes and the model code are always news; forms and lists are not", () => {
  const src = "Tripura State Election Commission";
  const notice = (title) => isElectionNotice({ source_name: src, title, url: "" });
  assert.equal(notice("Schedule of General Election to the Urban Local Bodies 2026"), true);
  assert.equal(notice("Prees Note on Declaration of Election Schedule"), true);
  assert.equal(notice("Model Code of Conduct (MCC) in connection with General Election"), true);
  // every phone-alerted election notice is drafted; the "election" flag only marks it (see the auto-publish test below)
  assert.equal(notice("Nomination Form (Form-2) in connection with General Election"), true);
  assert.equal(notice("List of Final Polling Stations in connection with General Election"), true);
  assert.equal(notice("ARO Notification for General Election"), true);
  assert.equal(notice("List of Sector Officer in connection with General Election to the Urban Local Bodies 2026"), true);
  assert.equal(notice("Result for TTAAD Village Committee Election 2026"), true);
  assert.equal(isElectionNotice({ source_name: "CMO Tripura", title: "Schedule of visits", url: "" }), false);
});

test("an election draft follows the normal auto-publish rule, with a score of at least 8; other flags still hold it", () => {
  const rules = { enabled: true, minScore: 7 };
  const draft = { headline: "Sector officers named", body: "The letter lists sector officers.", flags: ["election"], score: 9 };
  assert.equal(autoPublishCheck(draft, rules).ok, true);
  assert.equal(autoPublishCheck({ ...draft, score: 8 }, rules).ok, true);
  // a non-election draft is still allowed from the general minimum (7), an election draft is not
  assert.equal(autoPublishCheck({ ...draft, flags: [], score: 7 }, rules).ok, true);
  assert.match(autoPublishCheck({ ...draft, score: 7 }, rules).reason, /below 8/);
  // sensitive, [CHECK] notes, video and scanned sources still wait for the editor
  assert.match(autoPublishCheck({ ...draft, flags: ["election", "sensitive"] }, rules).reason, /flagged: sensitive/);
  assert.match(autoPublishCheck({ ...draft, body: "Reply not heard [CHECK: other side not heard]" }, rules).reason, /CHECK/);
  assert.equal(autoPublishCheck({ ...draft, sources: [{ kind: "video" }] }, rules).ok, false);
  assert.equal(autoPublishCheck(draft, { enabled: false }).ok, false);
});

test("an election press note from the police or a department counts as election news; ordinary notices do not", () => {
  const note = (source_name, title) => isElectionNotice({ source_name, title, url: "" });
  assert.equal(note("Tripura Police", "Press release: security arrangements for the Municipal Election, 2026"), true);
  assert.equal(note("Urban Development Department, Tripura (municipal bodies)", "Notice: Model Code of Conduct applies to all municipal bodies"), true);
  assert.equal(note("Tripura Police", "Press release: road safety week begins"), false);
  assert.equal(note("Tripura Police", "Candidate list of the sports quota"), false); // a topic word alone, no press note or notice words
});
