// The election watcher: every 15 minutes it checks only the election offices' pages (sites with "watch": true in
// hunter.json). A new link is saved for the News Hunter (which writes the draft on its next run), and a new
// election schedule, press note or poll announcement is sent to the editor's phone straight away.
// It runs on the website's Mumbai server (app/api/election-watch/route.js), started by supabase/election-watch.sql.
import crypto from "node:crypto";
import { extractLinks, looksLikeItem, isDocument } from "./pages.js";
import { ADMIN_URL } from "./alert.js";

// Words that make a new election link worth a phone alert. Other new links only go to the Hunter.
const IMPORTANT = /schedule|press\s*note|press\s*release|announce|programme|poll|bye|by-election|counting|result|notification|model code|mcc|election to|general election/i;

// An election office's schedule, press note, election notification, model code or result: the Hunter always treats
// it as news. Narrower than IMPORTANT: forms, polling-station lists and officer appointments stay routine.
const MAJOR = /schedule|press\s*(note|release)|announce|programme|counting|result|model code|\bmcc\b|election notification/i;
const readable = (url) => {
  try {
    return decodeURIComponent(url || "");
  } catch {
    return url || "";
  }
};
export const isElectionNotice = (item) => /election/i.test(item.source_name || "") && MAJOR.test(`${item.title || ""} ${readable(item.url)}`);
const ALERTS_PER_PAGE = 3; // a site that suddenly lists many links sends at most this many alerts
const SITE_SECONDS = 40; // a slow site is left for the next check, so the whole check stays under a minute

// A password made from the Supabase secret key, like the Hunter's relay. The key itself is never sent.
export const watchToken = (secret) => crypto.createHash("sha256").update(`election-watch:${secret}`).digest("hex");

export async function watchElections({ store, get, config, alert = null, now = Date.now(), log = console.log }) {
  const result = { pages_ok: 0, pages_failed: [], new_links: 0, alerts: 0 };
  const sites = config.sites.filter((s) => s.enabled && s.watch);

  async function checkSite(site) {
    for (const pageUrl of site.pages) {
      const page = await get(pageUrl);
      if (!page.ok) {
        result.pages_failed.push({ name: site.name, url: pageUrl, error: page.reason });
        continue;
      }
      result.pages_ok++;
      let links = extractLinks(page.text, page.url).filter((l) => looksLikeItem(l, page.url));
      if (links.length < 3) links = extractLinks(page.text, page.url, { keepMenus: true }).filter((l) => looksLikeItem(l, page.url));
      const known = await store.knownUrls(links.map((l) => l.url));
      const fresh = links.filter((l) => !known.has(l.url));
      const firstVisit = !(await store.getPage(pageUrl))?.last_ok;
      // First visit: everything already on the page is old news, remembered without alerts.
      const rows = fresh.map((l) => ({ url: l.url, title: l.text, kind: isDocument(l.url) ? "pdf" : "page", source_name: site.name, state: site.state, status: firstVisit ? "baseline" : "queued" }));
      await store.addItems(rows);
      await store.savePage({ url: pageUrl, source_name: site.name, last_ok: new Date(now).toISOString(), last_error: null });
      if (firstVisit) continue;
      result.new_links += rows.length;
      for (const row of rows.filter((r) => IMPORTANT.test(`${r.title} ${decodeURIComponent(r.url)}`)).slice(0, ALERTS_PER_PAGE)) {
        if (!alert) continue;
        try {
          await alert({ title: row.title || "New notice", state: site.state, source: site.name, url: row.url, label: "🗳️ ELECTION",
            // The watcher only spots the link; the Hunter writes the draft at its next hourly run.
            footer: `Read it now at the link above. The Hunter writes a draft within the hour: ${ADMIN_URL}` });
          result.alerts++;
        } catch (err) {
          log(`  ✗ alert not sent: ${err.message}`);
        }
      }
    }
  }

  // Each site is checked on its own, all at the same time; one slow site does not hold up the others.
  await Promise.all(
    sites.map(async (site) => {
      let timer;
      const tooSlow = new Promise((resolve) => (timer = setTimeout(() => resolve("slow"), SITE_SECONDS * 1000)));
      try {
        if ((await Promise.race([checkSite(site), tooSlow])) === "slow") result.pages_failed.push({ name: site.name, error: "too slow, checked next time" });
      } catch (err) {
        result.pages_failed.push({ name: site.name, error: err.message });
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return result;
}
