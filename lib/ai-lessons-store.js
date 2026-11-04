// Where the "Teach the AI" lessons are kept: one site setting ("ai_lessons"), so no new database table is needed.
// The rules for lessons are in lib/ai-lessons.js.
import crypto from "node:crypto";
import { db } from "./db.js";
import { LIMITS, makeLesson, normaliseLesson } from "./ai-lessons.js";

const KEY = "ai_lessons";

// All lessons, newest first. If the database cannot be read, the AI tools carry on without lessons.
export async function loadLessons(store = db, log = () => {}) {
  try {
    const value = await store.getSetting(KEY);
    return (Array.isArray(value) ? value : []).map(normaliseLesson).filter(Boolean);
  } catch (err) {
    log(`The AI lessons could not be read: ${err.message}`);
    return [];
  }
}

async function save(store, lessons) {
  await store.setSetting(KEY, lessons);
}

// Adds a lesson. The admin's own lessons are used at once; other staff's lessons wait for the admin.
// Returns { ok: true, lesson } or { ok: false, error }.
export async function addLesson(input, user, { store = db, now = new Date() } = {}) {
  const made = makeLesson(input);
  if (made.error) return { ok: false, error: made.error };
  const lessons = await loadLessons(store);
  if (lessons.length >= LIMITS.lessons) return { ok: false, error: `There are already ${LIMITS.lessons} lessons. Delete some old ones first.` };
  const same = lessons.find((l) => l.phrase.toLowerCase() === made.lesson.phrase.toLowerCase() && l.status !== "off");
  if (same) return { ok: false, error: `There is already a lesson for "${same.phrase}".` };
  const admin = user?.role === "admin";
  if (admin && lessons.filter((l) => l.status === "active").length >= LIMITS.active) {
    return { ok: false, error: `${LIMITS.active} lessons are in use, the most the AI can follow well. Switch some off first.` };
  }
  const at = now.toISOString();
  const lesson = {
    id: crypto.randomUUID(),
    ...made.lesson,
    status: admin ? "active" : "waiting",
    by: String(user?.name || user?.role || "staff").slice(0, 80),
    created_at: at,
    ...(admin ? { decided_by: String(user.name || "admin").slice(0, 80), decided_at: at } : {}),
  };
  await save(store, [lesson, ...lessons]);
  return { ok: true, lesson };
}

// The admin approves, switches off or deletes a lesson. Returns { ok, error? }.
export async function decideLesson(id, op, user, { store = db, now = new Date() } = {}) {
  if (user?.role !== "admin") return { ok: false, error: "Only the admin can do that." };
  const lessons = await loadLessons(store);
  const lesson = lessons.find((l) => l.id === id);
  if (!lesson) return { ok: false, error: "That lesson was not found." };
  if (op === "delete") {
    await save(store, lessons.filter((l) => l.id !== id));
    return { ok: true };
  }
  const status = { approve: "active", on: "active", off: "off" }[op];
  if (!status) return { ok: false, error: "Unknown action." };
  if (status === "active" && lesson.status !== "active" && lessons.filter((l) => l.status === "active").length >= LIMITS.active) {
    return { ok: false, error: `${LIMITS.active} lessons are in use, the most the AI can follow well. Switch some off first.` };
  }
  Object.assign(lesson, { status, decided_by: String(user.name || "admin").slice(0, 80), decided_at: now.toISOString() });
  await save(store, lessons);
  return { ok: true };
}
