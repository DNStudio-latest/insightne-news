// Fetching web pages on the server (News Hunter, Research desk, the government-page relay) with protection against
// SSRF: a hostile page or redirect must not be able to make our server read private addresses (the computer's own
// services, the cloud's internal network). Every address a request would go to, including each redirect, is checked.
import dns from "node:dns/promises";
import net from "node:net";

const MAX_REDIRECTS = 5;
const PORTS = new Set(["", "80", "443"]);

// Is this IP address one that only belongs to private networks, the machine itself, or the cloud's inside?
export function isPrivateAddress(address) {
  const ip = String(address).toLowerCase().replace(/^\[|\]$/g, "");
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || // "this network"
      a === 10 || // private
      a === 127 || // the machine itself
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, including the cloud metadata address 169.254.169.254
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 192 && b === 0) || // special use
      (a === 198 && (b === 18 || b === 19)) || // benchmarking
      a >= 224 // multicast, reserved, broadcast
    );
  }
  if (net.isIPv6(ip)) {
    if (ip === "::" || ip === "::1") return true;
    const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/); // IPv4 written inside IPv6
    if (mapped) return isPrivateAddress(mapped[1]);
    const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const n = (parseInt(mappedHex[1], 16) << 16) | parseInt(mappedHex[2], 16);
      return isPrivateAddress(`${(n >>> 24) & 255}.${(n >>> 16) & 255}.${(n >>> 8) & 255}.${n & 255}`);
    }
    return /^(fc|fd)/.test(ip) || /^fe[89ab]/.test(ip) || /^ff/.test(ip); // unique-local, link-local, multicast
  }
  return true; // not an IP address at all
}

// Throws when the address is not a normal public web page.
export async function assertPublicUrl(raw, { lookup = (host) => dns.lookup(host, { all: true }) } = {}) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("not a valid web address");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("only http and https addresses are allowed");
  if (url.username || url.password) throw new Error("addresses with a user name or password are not allowed");
  if (!PORTS.has(url.port)) throw new Error("only the normal web ports are allowed");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)$/i.test(host)) throw new Error("private address blocked");
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("private address blocked");
    return url;
  }
  const found = await lookup(host);
  if (!found.length || found.some((f) => isPrivateAddress(f.address))) throw new Error("private address blocked");
  return url;
}

// Like fetch(), but every step is checked and redirects are followed by hand (at most 5).
// allow(url) can restrict the addresses further (for example, only government websites).
export async function safeFetch(url, init = {}, { allow = null, fetchFn = fetch, lookup } = {}) {
  let current = String(url);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current, { lookup });
    if (allow && !allow(current)) throw new Error("address not allowed");
    const res = await fetchFn(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (init.redirect === "manual") return res;
      current = new URL(res.headers.get("location"), current).toString();
      await res.body?.cancel?.().catch(() => {});
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}
