import { test } from "node:test";
import assert from "node:assert/strict";
import { editedByName, SUB_EDITOR } from "../lib/staff.js";

const titli = { role: "editor", id: "e-titli", name: "Titli Chakraborty" };
const rina = { role: SUB_EDITOR, id: "s-rina", name: "Rina Das" };

test("an editor editing a sub-editor's story is recorded by name", () => {
  assert.equal(editedByName(titli, { author_id: "s-rina" }), "Titli Chakraborty");
});

test("nothing is recorded for the sub-editor's own edits, editor-written stories, or the admin", () => {
  assert.equal(editedByName(rina, { author_id: "s-rina" }), undefined);
  assert.equal(editedByName(titli, { author_id: null }), undefined);
  assert.equal(editedByName(titli, { author_id: "e-titli" }), undefined);
  assert.equal(editedByName({ role: "admin", name: "Admin" }, { author_id: "s-rina" }), undefined);
  assert.equal(editedByName(null, { author_id: "s-rina" }), undefined);
});
