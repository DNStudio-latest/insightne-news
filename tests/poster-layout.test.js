import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { chooseLayout } from "../lib/poster-layout.js";

// A calm grey 1920 x 1080 scene with one busy, colourful "person" block placed at the left, right, middle or low down.
async function scene(cx, cy, w = 420, h = 560) {
  const cells = [];
  for (let y = 0; y < h; y += 28) for (let x = 0; x < w; x += 28) cells.push({ input: { create: { width: 28, height: 28, channels: 3, background: (x / 28 + y / 28) % 2 ? "#e0a020" : "#a02040" } }, left: Math.round(cx - w / 2) + x, top: Math.round(cy - h / 2) + y });
  return sharp({ create: { width: 1920, height: 1080, channels: 3, background: "#5a6670" } }).composite(cells).jpeg().toBuffer();
}

test("text goes to the side away from the subject, or along the bottom when the subject is in the middle", async () => {
  assert.equal((await chooseLayout(await scene(1500, 420))).layout, "left", "subject on the right -> text on the left");
  assert.equal((await chooseLayout(await scene(420, 420))).layout, "right", "subject on the left -> text on the right");
  assert.equal((await chooseLayout(await scene(960, 420))).layout, "bottom", "subject in the middle -> text along the bottom");
});

test("a long headline, or sides switched off, always uses the bottom", async () => {
  const right = await scene(1500, 420);
  assert.equal((await chooseLayout(right, { headlineLength: 160 })).layout, "bottom");
  assert.equal((await chooseLayout(right, { allowSides: false })).layout, "bottom");
});

test("a plain picture with no subject still gets a layout", async () => {
  const plain = await sharp({ create: { width: 1920, height: 1080, channels: 3, background: "#6a7a8a" } }).jpeg().toBuffer();
  const r = await chooseLayout(plain);
  assert.ok(["bottom", "left", "right"].includes(r.layout));
});
