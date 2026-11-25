import { test } from "node:test";
import assert from "node:assert/strict";
import { wwwRedirectTarget } from "../lib/canonical-host.js";

test("the plain address goes to www, keeping the path and the query", () => {
  assert.equal(wwwRedirectTarget("insightnenews.in", "/story/x", "?a=1"), "https://www.insightnenews.in/story/x?a=1");
  assert.equal(wwwRedirectTarget("INSIGHTNENEWS.IN:443", "/", ""), "https://www.insightnenews.in/");
});

test("www, localhost and other hosts are never redirected (no loop)", () => {
  assert.equal(wwwRedirectTarget("www.insightnenews.in", "/", ""), null);
  assert.equal(wwwRedirectTarget("localhost:3000", "/", ""), null);
  assert.equal(wwwRedirectTarget("", "/", ""), null);
  assert.equal(wwwRedirectTarget(undefined, "/", ""), null);
});
