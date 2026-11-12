// Lesson suggestions made from the desk's own edits. When someone edits an AI-written brief, the words they replaced
// are noted ("in a bid to" -> "to"). A replacement seen at least twice is offered on Admin -> Teach the AI as a lesson
// with one click; the admin still decides. Kept in the site setting "ai_lesson_suggestions" (no new table).
import { db } from "./db.js";
import { wordDiff } from "../app/admin/ai-check/diff.js";
import { loadLessons } from "./ai-lessons-store.js";

const KEY = "ai_lesson_suggestions";
export const MIN_COUNT = 2; // a change must be seen this many times before it is suggested
const MAX_KEPT = 300;

const clean = (s) => String(s || "").replace(/^[\s"'“”‘’(),.;:!?-]+|[\s"'“”‘’(),.;:!?-]+$/g, "").replace(/\s+/g, " ").toLowerCase();

// The wording changes between two texts: [{ from, to }] (to is "" when words were only cut).
// Figures, names and one-off rewrites are skipped: only short phrase swaps teach the AI something.
export function replacements(before, after) {
  const segments = wordDiff(before, after);
  if (!segments) return [];
  const out = [];
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].type !== "del") continue;
    const ins = segments[i + 1]?.type === "ins" ? segments[i + 1].text : "";
    const from = clean(segments[i].text);
    const to = clean(ins);
    const fromWords = from.split(" ").filter(Boolean).length;
    const toWords = to.split(" ").filter(Boolean).length;
    if (!from || fromWords > 6 || toWords > 8 || from === to) continue;
    if (/\d/.test(from + to) || /\n/.test(from + to)) continue;
    if (fromWords === 1 && from.length < 5) continue; // "a", "the", "his": too small to teach
    out.push({ from, to });
  }
  return out.slice(0, 8);
}

async function load(store) {
  try {
    const v = await store.getSetting(KEY);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

// Notes the changes between an AI-written text and the edited one. Never throws: a failure here must not stop a save.
export async function recordEdit(before, after, { store = db, now = new Date() } = {}) {
  try {
    const found = replacements(before, after);
    if (!found.length) return 0;
    const map = await load(store);
    for (const { from, to } of found) {
      const key = `${from}=>${to}`;
      const old = map[key] || { from, to, count: 0 };
      map[key] = { ...old, count: old.count + 1, last: now.toISOString() };
    }
    const keep = Object.entries(map).sort((a, b) => String(b[1].last).localeCompare(String(a[1].last))).slice(0, MAX_KEPT);
    await store.setSetting(KEY, Object.fromEntries(keep));
    return found.length;
  } catch {
    return 0;
  }
}

// Suggestions seen often enough, not dismissed, and not already a lesson. Most often first.
export async function suggestions({ store = db, min = MIN_COUNT, limit = 12 } = {}) {
  const map = await load(store);
  const lessons = await loadLessons(store);
  const known = new Set(lessons.map((l) => clean(l.phrase)));
  return Object.entries(map)
    .map(([key, v]) => ({ key, ...v }))
    .filter((s) => s.count >= min && !s.dismissed && !known.has(s.from))
    .sort((a, b) => b.count - a.count || String(b.last).localeCompare(String(a.last)))
    .slice(0, limit);
}

export async function dismissSuggestion(key, { store = db } = {}) {
  const map = await load(store);
  if (!map[key]) return false;
  map[key] = { ...map[key], dismissed: true };
  await store.setSetting(KEY, map);
  return true;
}
