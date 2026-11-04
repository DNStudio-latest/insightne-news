// Text handed between admin pages through localStorage, read once and then deleted.
// - HANDOFF_KEY: "Check this text for AI" in the story editor -> the AI checker.
// - DRAFT_KEY: "Open as a new story" in the AI checker -> a new story in Write story.
export const HANDOFF_KEY = "insightne-ai-check";
export const DRAFT_KEY = "insightne-ai-draft";
export const HANDOFF_MAX_AGE = 10 * 60 * 1000;

export function leave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() }));
    return true;
  } catch {
    return false; // storage blocked
  }
}

export function take(key) {
  try {
    const raw = localStorage.getItem(key);
    localStorage.removeItem(key);
    const value = JSON.parse(raw || "null");
    return value && Date.now() - value.at < HANDOFF_MAX_AGE ? value : null;
  } catch {
    return null;
  }
}
