// Your latest YouTube videos, read from YouTube's public feed (checked at most once an hour).
// The last list that worked is kept in the database, so the videos stay on the site when YouTube's feed is down.
import { settings } from "./config.js";
import { db } from "./db.js";

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

async function rememberedVideos(count) {
  return ((await db.getSetting("youtubeVideos").catch(() => null)) || []).slice(0, count);
}

export async function latestVideos(count = 4) {
  if (!settings.youtubeChannelId) return [];
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${settings.youtubeChannelId}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return rememberedVideos(count);
    const xml = await res.text();
    const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, 12).map(([, e]) => {
      const id = (e.match(/<yt:videoId>([^<]+)/) || [])[1];
      return {
        id,
        title: decode((e.match(/<title>([^<]+)/) || [])[1] || ""),
        published: (e.match(/<published>([^<]+)/) || [])[1],
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    });
    if (!videos.length) return rememberedVideos(count);
    db.setSetting("youtubeVideos", videos).catch(() => {});
    return videos.slice(0, count);
  } catch {
    return rememberedVideos(count); // YouTube slow or down: show the last list we had.
  }
}
