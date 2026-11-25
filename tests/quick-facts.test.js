import { test } from "node:test";
import assert from "node:assert/strict";
import { quickFacts } from "../lib/quick-facts.js";

test("a story gives its stored facts in reading order", () => {
  const rows = quickFacts({ region: "Tripura", topic: "Politics" }, { sources: [{ source_name: "Tripura State Election Commission" }, { source_name: "InsightNE" }], byline: "P Debnath", when: "26 Nov 2026" });
  assert.deepEqual(rows.map((r) => r.label), ["Where", "When", "Reported by", "Topic", "Sources"]);
  assert.equal(rows[0].value, "Tripura");
  assert.equal(rows[4].value, "Tripura State Election Commission, InsightNE");
});

test("empty facts are left out, and the region 'Northeast' reads as Northeast India", () => {
  const rows = quickFacts({ region: "Northeast", topic: null }, { sources: [], byline: "", when: "26 Nov 2026" });
  assert.deepEqual(rows.map((r) => [r.label, r.value]), [["Where", "Northeast India"], ["When", "26 Nov 2026"]]);
  assert.deepEqual(quickFacts(undefined), []);
});

test("at most three sources are listed", () => {
  const rows = quickFacts({ region: "Assam" }, { sources: ["a", "b", "c", "d"].map((source_name) => ({ source_name })) });
  assert.equal(rows.find((r) => r.label === "Sources").value, "a, b, c");
});
