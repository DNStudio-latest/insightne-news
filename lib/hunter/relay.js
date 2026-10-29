// Many Indian government websites refuse visitors from outside India, and GitHub's computers are in the USA.
// So on GitHub the Hunter asks your own website (its server runs in Mumbai) to fetch government pages for it:
// see app/api/hunter-fetch/route.js. Only *.gov.in and *.nic.in pages can be fetched this way.
import crypto from "node:crypto";

export const RELAY_URL = "https://www.insightnenews.in/api/hunter-fetch";

// A password made from the Supabase secret key, which both GitHub and Vercel already have.
// The key itself is never sent.
export const relayToken = (secret) => crypto.createHash("sha256").update(`hunter-fetch:${secret}`).digest("hex");

export function relayAllowed(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return (protocol === "https:" || protocol === "http:") && /(^|\.)(gov|nic)\.in$/i.test(hostname);
  } catch {
    return false;
  }
}

// A fetch that sends government pages through the website and everything else directly.
// If the website cannot help (for example, it is not updated yet), it tries directly.
export function createRelayFetch({ relayUrl = RELAY_URL, secret = process.env.SUPABASE_SECRET_KEY, fetchFn = fetch } = {}) {
  const token = relayToken(secret);
  return async function relayFetch(url, init = {}) {
    if (!relayAllowed(url)) return fetchFn(url, init);
    const res = await fetchFn(`${relayUrl}?url=${encodeURIComponent(url)}`, {
      headers: { authorization: `Bearer ${token}`, "x-forward-headers": JSON.stringify(init.headers || {}) },
      signal: init.signal,
    });
    if (res.headers.get("x-relay-error")) throw new Error(res.headers.get("x-relay-error"));
    if (!res.headers.get("x-relay-status")) return fetchFn(url, init);
    const relayed = new Response(res.body, { status: Number(res.headers.get("x-relay-status")), headers: res.headers });
    return Object.defineProperty(relayed, "url", { value: res.headers.get("x-relay-url") || url });
  };
}
