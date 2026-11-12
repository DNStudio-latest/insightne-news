// Makes uploaded photos smaller before they are saved: rotated to the right way up, at most 1600 pixels wide,
// and saved as WebP. Pages load faster and the photo storage lasts longer.
// Only real JPG, PNG and WEBP photos are accepted: what a file really is is read from its first bytes (the type the
// browser reports can be faked), and a file that cannot be turned into a photo is refused, never stored as it is.
import crypto from "node:crypto";
import sharp from "sharp";

const MAX_WIDTH = 1600;
const PHONE_WIDTH = 640;
const MAX_INPUT_PIXELS = 80_000_000; // a small file can hold a huge picture that would use up the server's memory

export class PhotoError extends Error {}

const ascii = (bytes, from, to) => String.fromCharCode(...bytes.slice(from, to));

// "image/jpeg", "image/png", "image/webp" — or null when the bytes are not one of those.
export function sniffImage(bytes) {
  const b = bytes;
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b[0] === 0x89 && ascii(b, 1, 4) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length > 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  return null;
}

export async function compressPhoto(bytes) {
  if (!sniffImage(bytes)) throw new PhotoError("The file is not a JPG, PNG or WEBP photo.");
  try {
    const out = await sharp(Buffer.from(bytes), { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    return { bytes: new Uint8Array(out), contentType: "image/webp" };
  } catch (err) {
    console.error("Photo could not be processed:", err.message);
    throw new PhotoError("The photo could not be read. Please try another one.");
  }
}

// Saves a photo in two sizes, side by side: the full one ("<id>.w1600.webp") and a phone-sized copy ("<id>.w640.webp"),
// so phones download about a fifth of the data (see lib/photo-url.js). Returns the full photo's address.
// If the phone copy cannot be saved, the photo is saved in one size only, under a name that asks for no phone copy.
export async function savePhoto(db, bytes) {
  const full = await compressPhoto(bytes);
  const id = crypto.randomUUID();
  try {
    const small = await sharp(Buffer.from(full.bytes)).resize({ width: PHONE_WIDTH, withoutEnlargement: true }).webp({ quality: 75 }).toBuffer();
    await db.uploadImage(new Uint8Array(small), "image/webp", `${id}.w640.webp`);
  } catch (err) {
    console.error("Phone-sized photo not saved:", err.message);
    return db.uploadImage(full.bytes, full.contentType, `${id}.webp`);
  }
  return db.uploadImage(full.bytes, full.contentType, `${id}.w1600.webp`);
}
