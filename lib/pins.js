// Pinned stories: the editor keeps an older, important story at the top of the front page.
export const MAX_PINNED = 4; // more than this would push the news off the front page

// The pinned stories to show: newest pin first, never the lead story (it already has the best place).
export function pinnedForFront(pinned, lead) {
  return (pinned || []).filter((s) => !lead || s.id !== lead.id);
}

// A list without the stories already placed elsewhere on the page.
export function withoutStories(stories, taken) {
  const ids = new Set((taken || []).map((s) => s.id));
  return stories.filter((s) => !ids.has(s.id));
}
