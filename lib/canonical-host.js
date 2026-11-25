// One web address for the whole site. Pages, sitemaps and canonical tags all use https://www.insightnenews.in, but the
// same pages were also answering at https://insightnenews.in. Search engines then see two copies, and the server keeps
// two cached copies of every page. This sends the plain address to the www address with a permanent redirect.
const PLAIN_HOST = "insightnenews.in";
const WWW_HOST = "www.insightnenews.in";

// host: the Host header as sent by the visitor. Returns the full www address to redirect to, or null (no redirect).
export function wwwRedirectTarget(host, pathname, search = "") {
  const name = String(host || "").toLowerCase().replace(/:\d+$/, "");
  if (name !== PLAIN_HOST) return null; // www, localhost, previews and anything else are left alone
  return `https://${WWW_HOST}${pathname || "/"}${search || ""}`;
}
