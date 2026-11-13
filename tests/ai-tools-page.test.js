import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../public/ai-tools/index.html", import.meta.url), "utf8");

test("the public checker loads its scripts from /ai-tools/ even when opened at /ai-tools (no trailing slash)", () => {
  assert.match(html, /<base href="\/ai-tools\/">/);
  assert.match(html, /from "\.\/engine\.js"/);
  assert.match(html, /from "\.\/model\.js"/);
});
