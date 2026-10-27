// Dates and times in Indian time, e.g. "24 Oct 2026, 2:30 pm".
const formatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dayFormatter = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(iso) {
  if (!iso) return "";
  return formatter.format(new Date(iso));
}

// "Monday, 26 October 2026"
export function formatDay(date = new Date()) {
  return dayFormatter.format(date);
}

// "5 min ago", "3 hours ago", or the date for older stories.
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return "";
  const minutes = Math.round((now - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}

// Each source shown once, even if it has two links (for example a site's main feed and its Tripura feed).
export function uniqueSources(sources = []) {
  const seen = new Set();
  return sources.filter((s) => !seen.has(s.source_name) && seen.add(s.source_name));
}

const YOUTUBE = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:\S*&)?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([\w-]{11})\S*$/i;

// The video id if this text is just a YouTube link, e.g. "https://youtu.be/abc123XYZ_0".
export function youtubeId(text) {
  return (String(text).trim().match(YOUTUBE) || [])[1] || null;
}

// Article text → blocks. A blank line starts a new paragraph, "## " a subheading, "> " a quote,
// and a YouTube link on its own line becomes a video.
export function articleBlocks(body = "") {
  return String(body)
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const video = youtubeId(p);
      if (video) return { type: "youtube", id: video };
      if (p.startsWith("## ")) return { type: "h2", text: p.slice(3).trim() };
      if (p.startsWith("> ")) return { type: "quote", text: p.replace(/^>\s?/gm, "").trim() };
      return { type: "p", text: p.replace(/\s*\n\s*/g, " ") };
    });
}

export function readingMinutes(text = "") {
  return Math.max(1, Math.round(String(text).split(/\s+/).filter(Boolean).length / 200));
}
