// Password protection for the approval page. Two kinds of login:
// - "admin" (you): ADMIN_PASSWORD secret setting — can do everything.
// - "editor": each reporter/editor added on /admin/editors, with their own name and password. They write,
//   upload photos and edit; their name becomes the byline. They can't approve news, reject or change site tools.
// - "sub_editor": an editor marked as sub-editor on /admin/editors. Same sign-in, but they see and edit only
//   their own stories, and can't make a story the lead or breaking news.
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db.js";
import { settings } from "./config.js";
import { SUB_EDITOR } from "./staff.js";

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

// Editor passwords are kept only as a scrambled check value ("salt:hash").
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  return `${salt}:${crypto.scryptSync(password, salt, 32).toString("hex")}`;
}
function passwordMatches(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  return crypto.timingSafeEqual(crypto.scryptSync(password, salt, 32), Buffer.from(hash, "hex"));
}

// Who a password belongs to: { role: "admin" } or { role: "editor", id }, or null.
export async function userForPassword(password) {
  const admin = process.env.ADMIN_PASSWORD;
  if (!admin) throw new Error("ADMIN_PASSWORD is not set.");
  if (sameText(password, admin)) return { role: "admin" };
  const editors = await db.listEditors().catch(() => []);
  const editor = editors.find((e) => e.active && passwordMatches(password, e.password_hash));
  return editor ? { role: "editor", id: editor.id } : null;
}

export async function startSession({ role = "admin", id = "" } = {}) {
  const expires = String(Date.now() + DAYS * 86400000);
  const value = role === "editor" ? `editor:${expires}:${id}` : `admin:${expires}`;
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

// The signed-in person: { role: "admin" | "editor" | "sub_editor", name, id } — or null when not signed in.
export async function currentUser() {
  const cookie = (await cookies()).get(COOKIE)?.value;
  if (!cookie) return null;
  const [value, signature] = cookie.split(".");
  if (!value || !signature || !sameText(signature, sign(value))) return null;
  // Older sign-ins (from before editors existed) hold only the time and belong to the admin.
  const [role, expires, id] = value.includes(":") ? value.split(":") : ["admin", value];
  if (Number(expires) < Date.now()) return null;
  if (role === "admin") return { role, name: settings.publisher?.editor || settings.defaultAuthor, id: null };
  if (role !== "editor" || !id) return null;
  // Removing or switching off an editor on /admin/editors signs them out at once.
  const editor = await db.getEditor(id).catch(() => null);
  if (!editor?.active) return null;
  return { role: editor.role === SUB_EDITOR ? SUB_EDITOR : "editor", name: editor.name, id };
}

export async function currentRole() {
  return (await currentUser())?.role || null;
}

export async function isLoggedIn() {
  return Boolean(await currentRole());
}

export async function isAdmin() {
  return (await currentRole()) === "admin";
}
