// Shares the big updates of a live count on Facebook and Instagram: a Result poster (app/poster/result/[election]) with a
// caption made from the verified numbers, the link to the live page and the source. Counted against its own daily limit
// (results.json social.maxPerDay), separate from the news posts. Never used for the rehearsal.
import { settings } from "../config.js";
import { facebookReady, postImageToFacebook } from "../facebook.js";
import { instagramReady, publishImageToInstagram } from "../instagram.js";
import { logSocial, postsInLast24h } from "../social.js";

const FB = "Facebook (results)";
const IG = "Instagram (results)";

export const pageUrl = (cfg) => new URL(`/results/${cfg.slug}`, settings.siteUrl).toString();

export function posterAddress(cfg, event, shape, v = Date.now()) {
  const p = event.poster || {};
  const q = new URLSearchParams({ kind: p.kind || "tally", ...(p.unit ? { unit: p.unit } : {}), ...(p.seat ? { seat: p.seat } : {}), shape, format: "jpg", v: String(v) });
  return new URL(`/poster/result/${cfg.slug}?${q}`, settings.siteUrl).toString();
}

export function captionFor(cfg, event, { link = true } = {}) {
  return [
    `🔴 ${event.text}`,
    "",
    link ? `Follow the counting live: ${pageUrl(cfg)}` : `Follow the counting live: link in bio (${settings.siteUrl.replace(/^https?:\/\/(www\.)?/, "")}/results)`,
    "",
    "Source: State Election Commission, Tripura. Figures are as entered by the Returning Officers at the counting centres; the official portal is final.",
    "",
    "#TripuraCivicPolls #Tripura #ElectionResults #InsightNE",
  ].join("\n");
}

// events: from detectMilestones. Returns one row per event: { key, title, facebook, instagram } ("posted", "skipped: ..." or an error).
export async function shareMilestones(db, cfg, events) {
  const cap = Math.max(1, Number(cfg.social?.maxPerDay) || 25);
  const rows = [];
  for (const e of events) {
    const row = { key: e.key, title: e.title };
    const pseudo = { headline: e.title, slug: `results/${cfg.slug}` };
    const v = Date.now();
    for (const [network, label, ready, send] of [
      ["facebook", FB, facebookReady(), () => postImageToFacebook({ imageUrl: posterAddress(cfg, e, settings.poster?.facebookShape || "landscape", v), caption: captionFor(cfg, e) })],
      ["instagram", IG, instagramReady(), () => publishImageToInstagram(posterAddress(cfg, e, settings.poster?.instagramShape || "portrait", v), captionFor(cfg, e, { link: false }))],
    ]) {
      if (!ready) {
        row[network] = "skipped: not set up";
        continue;
      }
      if ((await postsInLast24h(db, label)) >= cap) {
        row[network] = `skipped: daily limit of ${cap}`;
        await logSocial(db, label, pseudo, `Daily limit of ${cap} reached: not posted.`);
        continue;
      }
      try {
        await send();
        row[network] = "posted";
        await logSocial(db, label, pseudo);
      } catch (err) {
        row[network] = `error: ${err.message.slice(0, 120)}`;
        await logSocial(db, label, pseudo, err.message);
      }
    }
    rows.push(row);
  }
  return rows;
}
