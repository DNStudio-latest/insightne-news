// Password protection for the approval page. Two kinds of login:
// - "admin" (you): ADMIN_PASSWORD — can do everything.
// - "editor": EDITOR_PASSWORD — can write, upload photos and edit, but not publish, reject or change site settings.
// The passwords live in secret settings, never in the code.
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

// Which login a password belongs to: "admin", "editor" or null.
export function roleForPassword(password) {
  const admin = process.env.ADMIN_PASSWORD;
  if (!admin) throw new Error("ADMIN_PASSWORD is not set.");
  if (sameText(password, admin)) return "admin";
  const editor = process.env.EDITOR_PASSWORD;
  if (editor && editor.length >= 8 && editor !== admin && sameText(password, editor)) return "editor";
  return null;
}

export async function startSession(role = "admin") {
  const expires = String(Date.now() + DAYS * 86400000);
  const value = `${role}:${expires}`;
  (await cookies()).set(COOKIE, `${value}.${sign(value)}`, {
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

// "admin", "editor", or null when not signed in.
export async function currentRole() {
  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!cookie) return null;
  const [value, signature] = cookie.split(".");
  if (!value || !signature || !sameText(signature, sign(value))) return null;
  // Older sign-ins (from before editors existed) hold only the time and belong to the admin.
  const [role, expires] = value.includes(":") ? value.split(":") : ["admin", value];
  if (Number(expires) < Date.now()) return null;
  if (role === "editor" && !process.env.EDITOR_PASSWORD) return null; // removing the editor password signs editors out
  return role === "admin" || role === "editor" ? role : null;
}

export async function isLoggedIn() {
  return Boolean(await currentRole());
}

export async function isAdmin() {
  return (await currentRole()) === "admin";
}
