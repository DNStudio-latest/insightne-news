// Screenshots of the source pages, kept as proof for each draft. A picture of the page shows exactly what
// the Hunter read, and the editor can use it as the photo illustration when you choose to.
// Uses Playwright with Chromium (installed with: npx playwright install chromium).
import { chromium } from "playwright";
import { compressPhoto } from "../photo.js";
import { USER_AGENT } from "./polite.js";

const TIMEOUT_MS = 30000;

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
        const png = await page.screenshot({ type: "png", fullPage: false });
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
