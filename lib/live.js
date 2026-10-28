// The live broadcast shown on the website (an official YouTube live stream chosen on /admin/live).
// It switches itself off after 12 hours, in case nobody presses END.
export const LIVE_HOURS = 12;

export async function currentLive(db) {
  const live = await db.getSetting("live").catch(() => null);
  if (!live?.youtubeId || !live.startedAt) return null;
  if (Date.now() - new Date(live.startedAt).getTime() > LIVE_HOURS * 3600000) return null;
  return live;
}
