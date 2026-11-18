import { test } from "node:test";
import assert from "node:assert/strict";
import { posterContent, posterEligible, headlineWords, keyPoints, dateline, sentences } from "../lib/poster-text.js";

const story = {
  status: "approved", kind: "original", region: "Tripura", published_at: "2026-11-19T10:00:00Z", image_url: "https://p/x.webp",
  headline: "Tripura Cabinet Approves Rs 120 Crore Plan For Rural Roads",
  summary: "The Tripura Cabinet on Wednesday approved a Rs 120 crore plan to repair rural roads in all eight districts. Chief Minister Manik Saha said work will start in December. The plan covers 340 km of roads.",
  body: "The Tripura Cabinet on Wednesday approved a Rs 120 crore plan to repair rural roads in all eight districts.\n\nChief Minister Manik Saha said work will start in December and finish within 18 months. The Public Works Department will invite tenders next week, an official said.",
};

test("only published stories with a picture get a poster", () => {
  assert.equal(posterEligible(story), true);
  assert.equal(posterEligible({ ...story, status: "pending" }), false);
  assert.equal(posterEligible({ ...story, image_url: null }), false);
});

test("the dateline shows the place and the Indian date", () => {
  assert.equal(dateline(story), "TRIPURA | NOVEMBER 19");
  assert.equal(dateline({ ...story, region: "Northeast", published_at: "2026-11-19T20:00:00Z" }), "NORTHEAST INDIA | NOVEMBER 20"); // 1:30 am next day in India
});

test("every poster line is a whole sentence of the story, never rewritten and never repeated", () => {
  const c = posterContent(story);
  const all = `${story.summary} ${story.body}`;
  assert.equal(c.headline, story.headline);
  for (const line of [c.supporting, ...c.points]) assert.ok(all.includes(line), `not from the story: ${line}`);
  assert.ok(c.points.length >= 2 && c.points.length <= 3);
  assert.ok(!c.points.includes(c.supporting));
  // "work will start in December" is told once, not twice in slightly different words
  assert.equal(c.points.filter((p) => /start in December/.test(p)).length, 1);
  // "340 km of roads" is told once: "The plan covers 340 km of roads." and "Officials said 340 km of roads will be repaired."
  const twice = posterContent({ ...story, summary: "The plan covers 340 km of roads. Officials said 340 km of roads will be repaired. Tenders open next week for the first phase.", body: "" });
  assert.equal([twice.supporting, ...twice.points].filter((p) => /340 km/.test(p)).length, 1);
  assert.ok(twice.points.some((p) => /Tenders open/.test(p)));
});

test("key points are skipped when they only repeat the headline, and long sentences are left out", () => {
  const s = { ...story, summary: "Tripura Cabinet approves Rs 120 crore plan for rural roads.", body: "A very long sentence that goes on and on without any real purpose at all, listing many many details that nobody could ever fit on a poster box without cutting it short. Work starts in December." };
  const c = posterContent(s);
  assert.equal(c.supporting, "");
  assert.deepEqual(c.points, ["Work starts in December."]);
});

test("headline highlight: figures with Rs, abbreviations and one noun, never a verb", () => {
  const keys = (h) => headlineWords(h).filter((w) => w.key).map((w) => w.text);
  assert.deepEqual(keys("Tripura Cabinet Approves Rs 120 Crore Plan For Rural Roads"), ["Cabinet", "Rs", "120"]);
  assert.deepEqual(keys("Meghalaya Hailstorm Disrupts Traffic"), ["Hailstorm"]);
  assert.deepEqual(keys("3 BSF jawans injured in Boxanagar"), ["3", "BSF", "Boxanagar"]);
});

test("the website shows the news graphic only for pictures labelled as AI illustrations, never for real photos", async () => {
  const { usesGraphic, graphicUrl } = await import("../lib/poster-text.js");
  const { settings } = await import("../lib/config.js");
  const ai = { ...story, slug: "tripura-cabinet-plan-abc123", image_credit: "AI-generated illustration" };
  assert.equal(usesGraphic(ai), true);
  assert.equal(usesGraphic({ ...story, image_credit: "InsightNE" }), false, "a real photo stays as it is");
  assert.equal(usesGraphic({ ...story, image_credit: null }), false);
  assert.equal(usesGraphic({ ...ai, status: "pending" }), false);
  assert.match(graphicUrl(ai, "card"), /^\/poster\/tripura-cabinet.*variant=web&size=card&v=[0-9a-f]{8}$/);
  assert.match(graphicUrl(ai, "full"), /size=full/);
  assert.match(graphicUrl(ai, "bogus"), /size=card/);
  // the address changes when the story's words change, so the stored picture is never out of date
  assert.notEqual(graphicUrl(ai), graphicUrl({ ...ai, headline: "A different headline" }));
  assert.equal(graphicUrl(ai), graphicUrl({ ...ai }));
  const before = settings.poster?.webGraphics;
  settings.poster = { ...(settings.poster || {}), webGraphics: false };
  assert.equal(usesGraphic(ai), false, "can be switched off in settings.json");
  settings.poster.webGraphics = before;
});

test("a breaking flag shows only when the story really is marked breaking", () => {
  assert.equal(posterContent(story).breaking, false);
  assert.equal(posterContent({ ...story, is_breaking: true }).breaking, true);
});

test("sentences are split whole and tiny fragments dropped", () => {
  assert.deepEqual(sentences("Police said 5 were held. Ok. The case is under investigation by the district team."), ["Police said 5 were held.", "The case is under investigation by the district team."]);
});
