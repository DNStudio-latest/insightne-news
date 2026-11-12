// Photos saved since November 2026 are kept in two sizes side by side: "<id>.w1600.webp" (full) and
// "<id>.w640.webp" (for phones). Older photos have one size only. Light enough to use on every page.
const FULL = /\.w1600\.webp$/;

// The phone-sized copy's address, or null when the photo has only one size.
export const smallPhotoUrl = (url) => (FULL.test(String(url || "")) ? String(url).replace(FULL, ".w640.webp") : null);

// The srcset and sizes attributes for an <img>, so phones download the small copy. Empty for older photos.
export function responsiveImage(url, sizes) {
  const small = smallPhotoUrl(url);
  return small ? { srcSet: `${small} 640w, ${url} 1600w`, sizes } : {};
}
