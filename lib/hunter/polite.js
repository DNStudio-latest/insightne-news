// Polite web reading for the News Hunter: it says who it is, obeys each site's robots.txt,
// waits between pages on the same site and never downloads very big files.
import "./extra-roots.js"; // trust Let's Encrypt's newer roots (needed for megipr.gov.in)

export const USER_AGENT = "InsightNE-NewsBot/1.0 (+https://www.insightnenews.in/about)";
const BOT_NAME = "insightne-newsbot";
const GAP_MS = Number(process.env.HUNTER_GAP_MS ?? 5000);
const MAX_BYTES = 25 * 1024 * 1024;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Reads robots.txt and returns the Allow/Disallow rules that apply to us (our own section, else "*").
export function parseRobots(text) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === "user-agent") {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === "allow" || key === "disallow") && value) current.rules.push({ allow: key === "allow", path: value });
    }
  }
  const ours = groups.find((g) => g.agents.some((a) => a !== "*" && BOT_NAME.startsWith(a)));
  return (ours || groups.find((g) => g.agents.includes("*")))?.rules || [];
}

// The longest matching rule wins, as Google does it; "*" and "$" are supported.
export function robotsAllows(rules, pathAndQuery) {
  let best = null;
  for (const rule of rules) {
    const pattern = new RegExp("^" + rule.path.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (pattern.test(pathAndQuery) && (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow))) best = rule;
  }
  return !best || best.allow;
}

export function createPoliteFetcher({ fetchFn = fetch, gapMs = GAP_MS, log = console.log } = {}) {
  const robots = new Map(); // host → rules
  const lastVisit = new Map(); // host → time

  async function rulesFor(url) {
    const { origin, host } = new URL(url);
    if (!robots.has(host)) {
      let rules = [];
      try {
        const res = await fetchFn(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(15000) });
        if (res.ok) rules = parseRobots(await res.text());
      } catch {
        // No robots.txt we can read: the site has set no rules.
      }
      robots.set(host, rules);
    }
    return robots.get(host);
  }

  // Returns { ok, status, type, bytes, text, url } or { ok: false, reason }.
  return async function get(url, { binary = false } = {}) {
    const { host, pathname, search } = new URL(url);
    if (!robotsAllows(await rulesFor(url), pathname + search)) return { ok: false, reason: "robots.txt says no" };
    const wait = (lastVisit.get(host) || 0) + gapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastVisit.set(host, Date.now());
    try {
      const res = await fetchFn(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-IN,en;q=0.9,bn;q=0.8" }, redirect: "follow", signal: AbortSignal.timeout(60000) });
      if (!res.ok) return { ok: false, status: res.status, reason: `HTTP ${res.status}` };
      if (Number(res.headers.get("content-length")) > MAX_BYTES) return { ok: false, reason: "file too big" };
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > MAX_BYTES) return { ok: false, reason: "file too big" };
      const type = (res.headers.get("content-type") || "").toLowerCase();
      return { ok: true, status: res.status, type, bytes, text: binary ? null : bytes.toString("utf8"), url: res.url || url };
    } catch (err) {
      log(`  ✗ ${url}: ${err.message}`);
      return { ok: false, reason: err.message };
    }
  };
}
