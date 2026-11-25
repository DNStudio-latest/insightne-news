import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptBackup, decryptBackup, exportDatabase, packBackup } from "../lib/backup.js";

const PASS = "a-long-test-passphrase-123";

test("a locked backup unlocks with the right passphrase only", () => {
  const file = encryptBackup(Buffer.from("hello news"), PASS);
  assert.equal(decryptBackup(file, PASS).toString(), "hello news");
  assert.throws(() => decryptBackup(file, "another-long-passphrase-456"), /Wrong passphrase/);
  const damaged = Buffer.from(file);
  damaged[damaged.length - 1] ^= 1;
  assert.throws(() => decryptBackup(damaged, PASS), /Wrong passphrase|damaged/);
  assert.throws(() => decryptBackup(Buffer.from("not a backup at all......................................................"), PASS), /not an InsightNE backup/);
});

test("a short passphrase is refused", () => {
  assert.throws(() => encryptBackup(Buffer.from("x"), "short"), /too short/);
});

// A tiny fake database: two tables, one with 2,300 rows so it needs three pages.
function fakeFetch() {
  const big = Array.from({ length: 2300 }, (_, i) => ({ id: i }));
  return async (url, opts = {}) => {
    const u = new URL(url);
    if (u.pathname === "/rest/v1/") {
      return { ok: true, json: async () => ({ definitions: { stories: { properties: { id: { description: "Note:\nThis is a Primary Key.<pk/>" } } }, polls: { properties: { id: {} } } } }) };
    }
    const [from, to] = String(opts.headers.Range).split("-").map(Number);
    const rows = u.pathname.endsWith("/stories") ? big : [{ id: "p1" }];
    return { ok: true, json: async () => rows.slice(from, to + 1) };
  };
}

test("every row of every table is read, over several pages, and checked after locking", async () => {
  const data = await exportDatabase({ url: "https://x.test", key: "k", fetchFn: fakeFetch(), now: new Date("2026-11-30T00:00:00Z") });
  assert.deepEqual(data.counts, { stories: 2300, polls: 1 });
  assert.equal(data.exported_at, "2026-11-30T00:00:00.000Z");
  const file = packBackup(data, PASS);
  const back = JSON.parse(decryptBackup(file, PASS).toString());
  assert.equal(back.tables.stories.length, 2300);
});

test("a table that cannot be read stops the backup (never a partial file)", async () => {
  const f = async (url) => (url.endsWith("/rest/v1/") ? { ok: true, json: async () => ({ definitions: { stories: { properties: {} } } }) } : { ok: false, status: 500 });
  await assert.rejects(() => exportDatabase({ url: "https://x.test", key: "k", fetchFn: f }), /Could not read table stories/);
});
