import { test } from "node:test";
import assert from "node:assert/strict";
import { pictureOf, proofShotOf, photoGallery } from "../lib/proof-shot.js";

const shot = "https://x/shot.webp";

test("an older Hunter story: its screenshot is proof, not its picture", () => {
  const story = { image_url: shot, image_caption: "Screenshot of the official page: DM Kohima", gallery: [] };
  assert.equal(pictureOf(story), null);
  assert.deepEqual(proofShotOf(story), { url: shot, caption: "Screenshot of the official page: DM Kohima" });
});

test("a newer Hunter story: the AI illustration is the picture, the screenshot stays in the gallery as proof", () => {
  const story = { image_url: "https://x/ai.jpg", image_credit: "AI-generated illustration", gallery: [{ url: shot, caption: "Screenshot of the official page: CEO Tripura" }, { url: "https://x/p.jpg", caption: "Crowd" }] };
  assert.equal(pictureOf(story), "https://x/ai.jpg");
  assert.equal(proofShotOf(story).url, shot);
  assert.deepEqual(photoGallery(story), [{ url: "https://x/p.jpg", caption: "Crowd" }]);
});

test("a reporter's own photo is untouched", () => {
  const story = { image_url: "https://x/photo.jpg", image_caption: "Rally at Melarmath", gallery: null };
  assert.equal(pictureOf(story), "https://x/photo.jpg");
  assert.equal(proofShotOf(story), null);
  assert.deepEqual(photoGallery(story), []);
});
