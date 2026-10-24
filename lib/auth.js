// Password protection for the approval page.
// The password lives in the ADMIN_PASSWORD secret setting, never in the code.
import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "ine_admin";
const DAYS = 30;

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET is missing or too short (use at least 16 random characters).");
  return s;
}

const sign = (value) => crypto.createHmac("sha256", secret()).update(value).digest("hex");

const sameText = (a, b) => {
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export function passwordIsCorrect(password) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) throw new Error("ADMIN_PASSWORD is not set.");
  return sameText(password, real);
}

export async function startSession() {
  const expires = String(Date.now() + DAYS * 86400000);
  (await cookies()).set(COOKIE, `${expires}.${sign(expires)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isLoggedIn() {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature || Number(expires) < Date.now()) return false;
  return sameText(signature, sign(expires));
}
