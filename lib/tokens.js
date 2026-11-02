// Checking the "password" that the News Hunter's helpers send to the website (a long code made from the Supabase
// secret key). The comparison takes the same time whether the code is nearly right or completely wrong, so it cannot
// be guessed letter by letter.
import crypto from "node:crypto";

const digest = (value) => crypto.createHash("sha256").update(String(value)).digest();

export function sameSecret(a, b) {
  return crypto.timingSafeEqual(digest(a), digest(b));
}

// True when the request carries "Authorization: Bearer <expected>".
export function hasBearer(request, expected) {
  if (!expected) return false;
  return sameSecret(request.headers.get("authorization") || "", `Bearer ${expected}`);
}
