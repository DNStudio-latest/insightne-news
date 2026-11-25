import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { hasChangingToken, withoutRepeats } from "../lib/hunter/repeats.js";
import { createLocalHunterStore } from "../lib/hunter/store.js";
import { watchElections } from "../lib/hunter/watch.js";

const token = (n) => `https://ceo.example.nic.in/Services/DownloadPdf.ashx?t=${String(n).padEnd(90, "a-Z_0")}`;

test("a long random code in a link is detected; ordinary links are not", () => {
  assert.equal(hasChangingToken(token(1)), true);
  assert.equal(hasChangingToken("https://x.gov.in/press-release/123?page=2"), false);
  assert.equal(hasChangingToken("https://x.gov.in/files/Notice.pdf"), false);
  assert.equal(hasChangingToken("not a web address"), false);
});

test("links with a changing code are new only when their title was never saved for the source", async () => {
  const store = createLocalHunterStore(path.join(os.tmpdir(), `repeats-${Date.now()}.json`));
  await store.addItems([{ url: token("old"), title: "Schedule for Bye Elections", source_name: "CEO", kind: "pdf", status: "baseline" }]);
  const links = [
    { url: token("a"), text: "Schedule for Bye Elections" }, // same notice, new code
    { url: token("b"), text: "Fresh notice about counting" },
    { url: token("c"), text: "Fresh notice about counting" }, // same title twice on one page
    { url: "https://ceo.example.nic.in/plain/1", text: "Schedule for Bye Elections" }, // no code: decided by its address
  ];
  const kept = await withoutRepeats(store, "CEO", links);
  assert.deepEqual(kept.map((l) => l.url), [token("b"), "https://ceo.example.nic.in/plain/1"]);
  // another source's titles do not count
  assert.equal((await withoutRepeats(store, "Other office", [links[0]])).length, 1);
});

const page = (links) => ({ ok: true, url: "https://ceo.example.nic.in/", text: `<html><body><main>${links.map(([href, text]) => `<p><a href="${href}">${text}</a></p>`).join("")}</main></body></html>` });
const config = { sites: [{ enabled: true, watch: true, state: "Manipur", name: "Chief Electoral Officer, Manipur", kind: "Election office", pages: ["https://ceo.example.nic.in/"] }] };

test("election watcher: the same old notices with new download codes on every visit cause no queue and no alerts", async () => {
  const store = createLocalHunterStore(path.join(os.tmpdir(), `watch-token-${Date.now()}.json`));
  const alerts = [];
  const alert = async (a) => alerts.push(a);
  const titles = ["Announcement of Election Schedule for Bye Elections", "Schedule for 12th General Elections to the Manipur Legislative Assembly", "Press note on counting of votes", "Notice for polling stations"];
  const visit = (round) => page(titles.map((t, i) => [token(`r${round}-${i}`), t]));
  await watchElections({ store, get: async () => visit(1), config, alert, log: () => {} }); // first visit: remembered quietly
  for (const round of [2, 3, 4]) {
    const out = await watchElections({ store, get: async () => visit(round), config, alert, log: () => {} });
    assert.equal(out.new_links, 0, `visit ${round} found no new notice`);
  }
  assert.equal(alerts.length, 0);
  assert.equal((await store.itemsWithStatus("queued")).length, 0);
  // a genuinely new notice (a new title) still alerts
  const out = await watchElections({ store, get: async () => page([...titles, "Press Note: Schedule for Municipal Election 2026"].map((t, i) => [token(`n${i}`), t])), config, alert, log: () => {} });
  assert.equal(out.new_links, 1);
  assert.equal(alerts.length, 1);
});

test("election watcher: a page that suddenly shows many new links is treated as a changed page, not news", async () => {
  const store = createLocalHunterStore(path.join(os.tmpdir(), `watch-burst-${Date.now()}.json`));
  const alerts = [];
  const alert = async (a) => alerts.push(a);
  const links = (n) => Array.from({ length: n }, (_, i) => [`/notice/${i}.pdf`, `Press note on election matter number ${i}`]);
  await watchElections({ store, get: async () => page(links(3)), config, alert, log: () => {} });
  const out = await watchElections({ store, get: async () => page(links(20)), config, alert, log: () => {} });
  assert.equal(out.new_links, 0);
  assert.equal(alerts.length, 0);
  assert.equal((await store.itemsWithStatus("queued")).length, 0);
});
