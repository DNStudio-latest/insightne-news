import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { savePhoto } from "../lib/photo.js";
import { smallPhotoUrl, responsiveImage } from "../lib/photo-url.js";

// A stand-in database that keeps what was uploaded.
const fakeDb = (failOn) => {
  const saved = [];
  return {
    saved,
    async uploadImage(bytes, contentType, name) {
      if (failOn && name.includes(failOn)) throw new Error("upload failed");
      saved.push({ bytes, contentType, name });
      return `https://photos.example/2026-11/${name}`;
    },
  };
};
const photo = async () => new Uint8Array(await sharp({ create: { width: 2400, height: 1350, channels: 3, background: "#3a7" } }).jpeg().toBuffer());

test("savePhoto keeps a full copy and a phone-sized copy side by side", async () => {
  const db = fakeDb();
  const url = await savePhoto(db, await photo());
  assert.match(url, /\.w1600\.webp$/);
  assert.equal(db.saved.length, 2);
  const [small, full] = db.saved;
  assert.equal(small.name.replace(".w640.webp", ""), full.name.replace(".w1600.webp", ""));
  assert.equal((await sharp(Buffer.from(small.bytes)).metadata()).width, 640);
  assert.equal((await sharp(Buffer.from(full.bytes)).metadata()).width, 1600);
  assert.ok(small.bytes.length < full.bytes.length);
});

test("if the phone copy cannot be saved, the photo is kept in one size with no phone copy promised", async () => {
  const db = fakeDb(".w640.");
  const url = await savePhoto(db, await photo());
  assert.doesNotMatch(url, /\.w1600\./);
  assert.equal(smallPhotoUrl(url), null);
});

test("responsiveImage offers the phone copy only for photos saved in two sizes", () => {
  assert.equal(smallPhotoUrl("https://p/x/abc.w1600.webp"), "https://p/x/abc.w640.webp");
  assert.equal(smallPhotoUrl("https://p/x/abc.webp"), null);
  assert.deepEqual(responsiveImage("https://p/abc.w1600.webp", "100vw"), { srcSet: "https://p/abc.w640.webp 640w, https://p/abc.w1600.webp 1600w", sizes: "100vw" });
  assert.deepEqual(responsiveImage("https://p/old.jpg", "100vw"), {});
});
