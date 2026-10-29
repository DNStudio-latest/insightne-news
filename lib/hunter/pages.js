// Reading government web pages: the links on a list page, and the title, date and text of one item.
import { parse } from "node-html-parser";
import { normalizeUrl } from "../text.js";

const DOCUMENT = /\.(pdf|docx?|odt)(\?|$)/i;
const SKIP_FILE = /\.(jpe?g|png|gif|webp|svg|zip|rar|mp4|mp3|wav|ogg|xlsx?|pptx?|css|js)(\?|$)/i;
// Website menus, headers and footers: the same links on every page, never news.
const MENUS = "nav, header, footer, aside, [role=navigation], [class*=menu], [id*=menu], [class*=navbar], [class*=breadcrumb], [class*=footer], [id*=footer], [class*=header], [id*=header], [class*=sidebar], [id*=sidebar]";
// Menu and service pages that are never news.
const SKIP_PATH = /(about|contact|sitemap|login|logout|register|feedback|help|disclaimer|privacy|terms|screen-?reader|accessib|faq|\brti\b|styleswitcher|copyright|hyperlink|website-policies|search|gallery|photo-?gallery|who-?s-?who|directory|organogram|citizen-charter|subscribe|\/tag\/|\/author\/|\/page\/\d+|wp-login|\/feed\/?$|\/category\/[^/]+\/?$|taxonomy\/term\/\d+\/?$)/i;
const SOCIAL = /(facebook|twitter|x|instagram|youtube|youtu|linkedin|whatsapp|t)\.(com|be|me)$/i;

export const isDocument = (url) => DOCUMENT.test(url);

// Every link on a page (outside its menus, unless keepMenus), as full addresses, without repeats: [{ url, text }].
export function extractLinks(html, pageUrl, { keepMenus = false } = {}) {
  const root = parse(html);
  if (!keepMenus) for (const el of root.querySelectorAll(MENUS)) el.remove();
  const seen = new Map();
  for (const a of root.querySelectorAll("a[href]")) {
    const href = (a.getAttribute("href") || "").trim();
    if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
    let url;
    try {
      url = new URL(href, pageUrl);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    url.hash = "";
    const key = normalizeUrl(url.toString());
    const text = a.text.replace(/\s+/g, " ").trim() || (a.getAttribute("title") || "").trim();
    if (!seen.has(key) || text.length > seen.get(key).text.length) seen.set(key, { url: url.toString(), text: text.slice(0, 300) });
  }
  return [...seen.values()];
}

// Could this link be a press release, notice or news item? (The AI makes the real decision later.)
export function looksLikeItem(link, pageUrl) {
  let url;
  try {
    url = new URL(link.url);
  } catch {
    return false;
  }
  const page = new URL(pageUrl);
  const sameSite = url.host.replace(/^www\./, "") === page.host.replace(/^www\./, "");
  const govSite = /\.(gov|nic)\.in$/.test(url.host);
  if (SOCIAL.test(url.host.replace(/^www\./, "")) || SKIP_FILE.test(url.pathname)) return false;
  if (isDocument(url.pathname)) return sameSite || govSite;
  if (!sameSite) return false;
  const path = decodeURIComponent(url.pathname).replace(/\/+$/, "");
  if (!path || SKIP_PATH.test(path + url.search)) return false;
  if (normalizeUrl(url.toString()) === normalizeUrl(pageUrl)) return false;
  const lastPart = path.split("/").pop();
  // A news item usually has a long name, a number, or a dated folder in its address.
  return lastPart.length >= 18 || /\d{2,}/.test(path + url.search) || link.text.length >= 40;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

// The first clear date in a piece of text (e.g. "29 October 2026", "October 29, 2026", "29-10-2026", "29.10.2026").
export function findDate(text) {
  const s = String(text || "").slice(0, 3000);
  const m1 = /\b(\d{1,2})(?:st|nd|rd|th)?[\s.-]+(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)[a-z]*[\s.,-]+(20\d\d)\b/i.exec(s);
  const m2 = /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(20\d\d)\b/i.exec(s);
  const m3 = /\b(\d{1,2})[./-](\d{1,2})[./-](20\d\d)\b/.exec(s);
  const month = (name) => MONTHS.findIndex((m) => m.startsWith(name.toLowerCase().slice(0, 3)));
  // The date written first wins (the publishing date usually comes before dates of events in the text).
  const first = [m1, m2, m3].filter(Boolean).sort((a, b) => a.index - b.index)[0];
  let d = null;
  if (first === m1) d = [Number(m1[3]), month(m1[2]), Number(m1[1])];
  else if (first === m2) d = [Number(m2[3]), month(m2[1]), Number(m2[2])];
  else if (first === m3) d = [Number(m3[3]), Number(m3[2]) - 1, Number(m3[1])];
  if (!d || d[1] < 0 || d[1] > 11 || d[2] < 1 || d[2] > 31) return null;
  return new Date(Date.UTC(d[0], d[1], d[2], 6, 30)).toISOString(); // noon in India
}

// The date written in a link's words or address, e.g. "e-Sambad-18-11-2022" or ".../files/2026-10/...".
export function dateFromLink(link) {
  let address = link.url;
  try {
    address = decodeURIComponent(link.url);
  } catch {
    // keep the address as it is
  }
  const found = findDate(link.text) || findDate(address.replace(/[_/]/g, " "));
  if (found) return found;
  const folder = /\/(20\d\d)-(\d\d)\//.exec(address);
  // Only the month is known: count it as the month's last day, so a recent item is never thought old.
  return folder ? new Date(Date.UTC(Number(folder[1]), Number(folder[2]), 0, 6, 30)).toISOString() : null;
}

// The title, date, main text and attached documents of one item page.
export function readItemPage(html, pageUrl) {
  const root = parse(html);
  const meta = (name) => root.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content")?.trim();
  for (const el of root.querySelectorAll("script, style, noscript, nav, header, footer, aside, form, iframe, svg")) el.remove();

  const candidates = root.querySelectorAll("article, main, [class*=field--name-body], [class*=entry-content], [class*=post-content], [class*=node__content], [class*=news-detail], [class*=content-area], [id*=content], [class*=content]");
  const best = candidates.reduce((a, b) => (b.text.trim().length > (a?.text.trim().length || 0) ? b : a), null) || root.querySelector("body") || root;
  const text = best.structuredText.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const title = meta("og:title") || root.querySelector("h1")?.text.trim() || root.querySelector("title")?.text.trim() || "";
  const published = meta("article:published_time") || findDate(text);
  const documents = extractLinks(best.toString(), pageUrl).filter((l) => isDocument(l.url)).slice(0, 3);
  return { title: title.replace(/\s+/g, " ").slice(0, 300), text: text.slice(0, 20000), published: published || null, documents };
}
