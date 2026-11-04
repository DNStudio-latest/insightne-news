import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("admin view totals: today (Indian date) and all time, from the practice-mode file", async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "views-")), "db.json");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  fs.writeFileSync(file, JSON.stringify({ views: { a: { [today]: 3, "2020-01-01": 2 }, b: { [today]: 1 } } }));
  process.env.LOCAL_DB_FILE = file;
  const { db } = await import("../lib/db.js");
  assert.deepEqual(await db.viewTotals(), { today: 4, all: 6 });
});
