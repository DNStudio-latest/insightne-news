import { test } from "node:test";
import assert from "node:assert/strict";
import { storyCounts, staffTitle, canEditKokborok, isOwnOnly, SUB_EDITOR, REPORTER } from "../lib/staff.js";

test("sub-editors get their own title", () => {
  assert.equal(staffTitle({ role: SUB_EDITOR }), "Sub-Editor");
  assert.equal(staffTitle({ role: REPORTER }), "Reporter");
  assert.equal(staffTitle({ role: "editor" }), "Editor");
  assert.equal(staffTitle({ name: "Older row without a role" }), "Editor");
  assert.equal(staffTitle(undefined), "Reporter");
});

test("sub-editors and reporters see only their own stories; editors and the admin do not", () => {
  assert.equal(isOwnOnly(SUB_EDITOR), true);
  assert.equal(isOwnOnly(REPORTER), true);
  assert.equal(isOwnOnly("editor"), false);
  assert.equal(isOwnOnly("admin"), false);
});

test("a reporter edits the Kokborok version only when named in settings", () => {
  assert.equal(canEditKokborok({ role: REPORTER, name: "Elisa" }, ["Elisa"]), true);
  assert.equal(canEditKokborok({ role: REPORTER, name: "Rina Das" }, ["Elisa"]), false);
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

test("Kokborok editing: editors and admin always; sub-editors only when named, letter case and spacing ignored", async () => {
  const { canEditKokborok } = await import("../lib/staff.js");
  const names = ["Elisa", "Anita", "Mary John"];
  assert.equal(canEditKokborok({ role: "admin", name: "Admin" }, []), true);
  assert.equal(canEditKokborok({ role: "editor", name: "Rina" }, []), true);
  assert.equal(canEditKokborok({ role: SUB_EDITOR, name: "elisa" }, names), true);
  assert.equal(canEditKokborok({ role: SUB_EDITOR, name: "  Mary   John " }, names), true);
  assert.equal(canEditKokborok({ role: SUB_EDITOR, name: "Mary" }, names), false);
  assert.equal(canEditKokborok({ role: SUB_EDITOR, name: "Amit Paul" }, names), false);
  assert.equal(canEditKokborok(null, names), false);
});
