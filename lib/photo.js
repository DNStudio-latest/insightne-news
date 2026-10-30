// Makes uploaded photos smaller before they are saved: rotated to the right way up, at most 1600 pixels wide,
// and saved as WebP. Pages load faster and the photo storage lasts longer. If anything fails, the original is kept.
import sharp from "sharp";

const MAX_WIDTH = 1600;

export async function compressPhoto(bytes, contentType) {
  try {
    const out = await sharp(Buffer.from(bytes), { failOn: "none" })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { bytes: new Uint8Array(out), contentType: "image/webp" };
  } catch (err) {
    console.error("Photo compression failed, keeping the original:", err.message);
    return { bytes, contentType };
  }
}
