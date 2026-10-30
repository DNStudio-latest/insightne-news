// Screenshots of the source pages, kept as proof for each draft. A picture of the page shows exactly what
// the Hunter read, and the editor can use it as the photo illustration when you choose to.
// Uses Playwright with Chromium (installed with: npx playwright install chromium).
import { chromium } from "playwright";
import { compressPhoto } from "../photo.js";
import { USER_AGENT } from "./polite.js";

const TIMEOUT_MS = 30000;

// Runs inside the page: hides the parts that are not the news (menus, headers, footers, ads, sidebars),
// then marks the largest block of text as the part to photograph.
function MARK_MAIN_CONTENT() {
  const junk = "header, nav, footer, aside, script, style, noscript, iframe, form, [class*=menu], [class*=sidebar], [class*=breadcrumb], [class*=cookie], [class*=advert], [class*=banner], [id*=menu], [id*=sidebar]";
  document.querySelectorAll(junk).forEach((el) => (el.style.display = "none"));
  // The news block first (article, main, content boxes); the whole page only when no such block has text.
  const pick = (selector) =>
    [...document.querySelectorAll(selector)]
      .map((el) => ({ el, len: (el.innerText || "").trim().length }))
      .filter((x) => x.len > 200)
      .sort((a, b) => b.len - a.len)[0];
  const best = pick("article, main, [class*=content], [class*=entry], [class*=post], [class*=detail], [id*=content]") || pick("body");
  if (best) best.el.setAttribute("data-proof-main", "");
}

// Returns capture(url) → { bytes, contentType } or null. The browser starts only when first needed.
export function createProofCapturer({ log = console.log } = {}) {
  let browser = null;

  async function open() {
    if (!browser) browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    return browser;
  }

  return {
    async capture(url) {
      const page = await (await open()).newPage({ userAgent: USER_AGENT, viewport: { width: 1200, height: 1500 }, locale: "en-IN" });
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
        await page.waitForTimeout(1500); // give the page a moment to draw its text and pictures
        // Hide menus, headers, footers and sidebars, then keep only the main text block.
        await page.evaluate(MARK_MAIN_CONTENT);
        const marked = page.locator("[data-proof-main]").first();
        const hasMain = (await marked.count()) > 0;
        const png = await (hasMain ? marked : page).screenshot({ type: "png" });
        return await compressPhoto(new Uint8Array(png), "image/png");
      } catch (err) {
        log(`  ✗ screenshot failed for ${url}: ${err.message.slice(0, 120)}`);
        return null;
      } finally {
        await page.close();
      }
    },
    async close() {
      if (browser) await browser.close();
      browser = null;
    },
  };
}
