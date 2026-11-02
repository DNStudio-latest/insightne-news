// Makes uploaded photos smaller before they are saved: rotated to the right way up, at most 1600 pixels wide,
// and saved as WebP. Pages load faster and the photo storage lasts longer.
// Only real JPG, PNG and WEBP photos are accepted: what a file really is is read from its first bytes (the type the
// browser reports can be faked), and a file that cannot be turned into a photo is refused, never stored as it is.
import sharp from "sharp";

const MAX_WIDTH = 1600;
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
