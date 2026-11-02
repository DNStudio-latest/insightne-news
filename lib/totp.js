// Two-step sign-in for the admin: a 6-digit code from an authenticator app (Google Authenticator, Microsoft
// Authenticator, Authy, ...) that changes every 30 seconds. Standard TOTP (RFC 6238), nothing sent anywhere.
// Switched on by setting ADMIN_TOTP_SECRET (see `npm run totp-setup`); without it, sign-in works as before.
import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes) {
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
  return out;
}

export function base32Decode(text) {
  let bits = "";
  for (const ch of String(text).toUpperCase().replace(/[\s=-]/g, "")) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("not a valid secret");
    bits += i.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

export const newTotpSecret = () => base32Encode(crypto.randomBytes(20));

// The code for one 30-second step.
export function totpCode(secret, step, digits = 6) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const value = ((hmac[offset] & 127) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(value % 10 ** digits).padStart(digits, "0");
}

let lastUsedStep = -1;

// True for the current code, or the one just before or after it (clocks differ a little). A code works only once.
export function verifyTotp(secret, code, now = Date.now()) {
  const given = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(given) || !secret) return false;
  const current = Math.floor(now / 30000);
  for (const step of [current, current - 1, current + 1]) {
    const expected = Buffer.from(totpCode(secret, step));
    if (crypto.timingSafeEqual(expected, Buffer.from(given)) && step > lastUsedStep) {
      lastUsedStep = step;
      return true;
    }
  }
  return false;
}

export const totpEnabled = () => Boolean(process.env.ADMIN_TOTP_SECRET);
