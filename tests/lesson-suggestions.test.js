import { test } from "node:test";
import assert from "node:assert/strict";
import { replacements, recordEdit, suggestions, dismissSuggestion } from "../lib/lesson-suggestions.js";

// A stand-in for the site settings table.
const memory = () => {
  const m = new Map();
  return { getSetting: async (k) => m.get(k), setSetting: async (k, v) => void m.set(k, v) };
};

test("replacements finds short phrase swaps and skips figures and tiny words", () => {
  const r = replacements("Officials said in a bid to speed up work 20 teams were sent.", "Officials said to speed up work 25 teams were sent.");
  assert.deepEqual(r, [{ from: "in a bid", to: "" }]);
  assert.deepEqual(replacements("The minister stated that roads will open", "The minister said that roads will open"), [{ from: "stated", to: "said" }]);
  assert.deepEqual(replacements("He is on the road", "He is at the road"), []); // two-letter words are too small to teach
});

test("a swap is suggested only after it was seen twice, never again once it is a lesson or dismissed", async () => {
  const store = memory();
  const before = "The minister stated that roads will open soon.";
  const after = "The minister said that roads will open soon.";
  await recordEdit(before, after, { store });
  assert.deepEqual(await suggestions({ store }), []);
  await recordEdit(before, after, { store });
  const s = await suggestions({ store });
  assert.equal(s.length, 1);
  assert.equal(s[0].from, "stated");
  assert.equal(s[0].to, "said");
  assert.equal(s[0].count, 2);
  await dismissSuggestion(s[0].key, { store });
  assert.deepEqual(await suggestions({ store }), []);
});

test("recordEdit never throws, even when the store fails", async () => {
  const broken = { getSetting: async () => { throw new Error("db down"); }, setSetting: async () => { throw new Error("db down"); } };
  assert.equal(await recordEdit("a stated b", "a said b", { store: broken }), 0);
});
