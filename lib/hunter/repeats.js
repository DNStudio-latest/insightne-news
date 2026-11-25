// Some websites put a new random code into every download link (for example ceomanipur.nic.in: DownloadPdf.ashx?t=...).
// The same old notice then looks brand new on every visit, so the Hunter and the election watcher queued it again and
// sent a phone alert for it each time. For such links the notice's title decides whether it is new.

// True when a link carries a long random code in its query (40 or more letters and digits).
export function hasChangingToken(url) {
  try {
    for (const [, value] of new URL(url).searchParams) if (value.length >= 40 && /^[A-Za-z0-9_\-+=/.%]+$/.test(value)) return true;
  } catch {
    // not a web address: nothing to check
  }
  return false;
}

export const titleKey = (title) => String(title || "").replace(/\s+/g, " ").trim().toLowerCase();

// items: the new links found on a page. Those with a changing code are kept only if their title was never saved for this
// source (and only once per title on this visit). Links without a changing code are always kept.
export async function withoutRepeats(store, sourceName, items, getTitle = (i) => i.text ?? i.title) {
  const tokened = items.filter((i) => hasChangingToken(i.url));
  if (!tokened.length) return items;
  const seen = await store.knownTitles(sourceName, tokened.map(getTitle));
  const kept = new Set();
  return items.filter((i) => {
    if (!hasChangingToken(i.url)) return true;
    const key = titleKey(getTitle(i));
    if (!key || seen.has(key) || kept.has(key)) return false;
    kept.add(key);
    return true;
  });
}
