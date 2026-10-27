// "Top 5 today": most read today first, then the most important and newest stories of the last 24 hours.
// Used by the /today page and the daily email.
export async function topStories(db, count = 5) {
  const since = Date.now() - 24 * 3600 * 1000;
  const [popular, recent] = await Promise.all([db.mostRead(1, count).catch(() => []), db.listStories({ status: "approved", limit: 60 })]);
  const fresh = recent.filter((s) => new Date(s.published_at).getTime() >= since);
  const ranked = [...fresh].sort((a, b) => (b.kind === "original") - (a.kind === "original") || (b.score ?? 9) - (a.score ?? 9));
  const picked = [];
  for (const s of [...popular, ...ranked, ...recent]) if (!picked.some((p) => p.id === s.id) && picked.length < count) picked.push(s);
  return picked;
}
