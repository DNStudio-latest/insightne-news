// Your latest YouTube videos, read from YouTube's public feed (checked at most once an hour).
import { settings } from "./config.js";

const decode = (s) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export async function latestVideos(count = 4) {
  if (!settings.youtubeChannelId) return [];
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${settings.youtubeChannelId}`, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, count).map(([, e]) => {
      const id = (e.match(/<yt:videoId>([^<]+)/) || [])[1];
      return {
        id,
        title: decode((e.match(/<title>([^<]+)/) || [])[1] || ""),
        published: (e.match(/<published>([^<]+)/) || [])[1],
        url: `https://www.youtube.com/watch?v=${id}`,
        thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    });
  } catch {
    return []; // If YouTube is slow or down, the page still works without videos.
  }
}
