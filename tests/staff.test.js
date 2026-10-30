import { test } from "node:test";
import assert from "node:assert/strict";
import { storyCounts, staffTitle, SUB_EDITOR } from "../lib/staff.js";

test("sub-editors get their own title", () => {
  assert.equal(staffTitle({ role: SUB_EDITOR }), "Sub-Editor");
  assert.equal(staffTitle({ role: "editor" }), "Reporter");
  assert.equal(staffTitle(undefined), "Reporter");
});

test("stories count for a person by id, or by byline name for older stories", () => {
  const editors = [{ id: "a", name: "Rina Das" }, { id: "b", name: "Amit Paul" }];
  const rows = [
    { author_id: "a", author: "Rina Das" },
    { author_id: "a", author: "Rina D." }, // renamed later: still hers by id
    { author_id: null, author: "Rina Das" }, // older story, matched by name
    { author_id: null, author: "Someone Else" },
    { author: "Amit Paul" },
  ];
  assert.deepEqual(storyCounts(rows, editors), { a: 3, b: 1 });
  assert.deepEqual(storyCounts([], editors), { a: 0, b: 0 });
});
