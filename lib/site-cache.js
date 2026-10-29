// The public pages keep the newest stories in memory for up to a minute, instead of asking the database
// for every reader. Pressing a button on the approval page empties it straight away (refreshSite),
// so a story you APPROVE still appears at once; stories the collector publishes appear within a minute.
// Only for the website: the approval page always reads the database directly.
import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "./db.js";
import { currentLive } from "./live.js";
import { latestVideos } from "./youtube.js";

const TAG = "site";
const keep = (name, fn) => unstable_cache(fn, [name], { revalidate: 60, tags: [TAG] });

export const site = {
  listStories: keep("listStories", (options) => db.listStories(options)),
  mostRead: keep("mostRead", (days, limit) => db.mostRead(days, limit)),
  live: keep("live", () => currentLive(db)),
  videos: keep("videos", (count) => latestVideos(count)),
  // The open poll and its vote totals (a new vote shows in the reader's own box straight away).
  poll: keep("poll", async () => {
    const poll = await db.openPoll();
    return poll && { poll, counts: await db.pollCounts(poll.id, poll.options.length) };
  }),
};

export function refreshSite() {
  revalidateTag(TAG, { expire: 0 });
}
