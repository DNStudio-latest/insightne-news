// Where the language switch (and anything similar) may send a visitor back to: a page of this website, never another one.
// The address is built first and its website must be this one, because "/\evil.com", "/<tab>/evil.com" and
// similar tricks look like a page of this site but are read by browsers as another website.
export function sameSiteTarget(back, requestUrl) {
  const home = new URL("/", requestUrl);
  try {
    const wanted = new URL(String(back || "/"), requestUrl);
    if (String(back).startsWith("/") && wanted.origin === home.origin) return wanted;
  } catch {}
  return home;
}
