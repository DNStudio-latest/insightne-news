import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PINNED, pinnedForFront, withoutStories } from "../lib/pins.js";

const story = (id) => ({ id, headline: `Story ${id}` });

test("pinned stories skip the lead and keep the pin order", () => {
  const pinned = [story("c"), story("a"), story("b")];
  assert.deepEqual(pinnedForFront(pinned, story("a")).map((s) => s.id), ["c", "b"]);
  assert.deepEqual(pinnedForFront(null, story("a")), []);
  assert.deepEqual(pinnedForFront(pinned, null).map((s) => s.id), ["c", "a", "b"]);
});

test("a story placed at the top is not repeated in the lists below", () => {
  const rest = withoutStories([story("a"), story("b"), story("c")], [story("b")]);
  assert.deepEqual(rest.map((s) => s.id), ["a", "c"]);
  assert.equal(withoutStories([story("a")], undefined).length, 1);
  assert.ok(MAX_PINNED >= 2 && MAX_PINNED <= 6);
});
