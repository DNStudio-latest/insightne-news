import test from "node:test";
import assert from "node:assert/strict";
import { seoChecks } from "../lib/seo-check.js";

const text = (c) => c.map((x) => `${x.level}:${x.text}`).join("\n");

test("a good headline and intro show no warnings", () => {
  const c = seoChecks({
    headline: "Tripura: 10,000 Security Personnel to Guard Municipal Polls",
    summary: "Around 10,000 security personnel, including state police and central forces, will be deployed in Tripura for the 27 November polls.",
    region: "Tripura",
  });
  assert.ok(!c.some((x) => x.level !== "ok"), text(c));
});

test("a long headline is warned and the cut-off point is shown", () => {
  const c = seoChecks({ headline: "Assamese Content Creator Jugamaya Dutta Dies in Tripura; Family Appeals Against Speculation", summary: "x ".repeat(40), region: "Assam" });
  assert.match(text(c), /bad:Headline is \d+ characters/);
});

test("weak words get the word people search for", () => {
  assert.match(text(seoChecks({ headline: "Jugamaya Dutta Dies in Guwahati", summary: "A short intro that is long enough to be seen as an intro in search results page." })), /“death”/);
  assert.match(text(seoChecks({ headline: "Police Nab Two in Agartala Robbery", summary: "A short intro that is long enough to be seen as an intro in search results page." })), /“arrested”/);
});

test("a missing place name is asked for", () => {
  assert.match(text(seoChecks({ headline: "Minister Inaugurates New Bridge Over River", summary: "", region: "" })), /Put the place/);
});

test("ALL CAPS, exclamation marks and clickbait are flagged", () => {
  const c = text(seoChecks({ headline: "SHOCKING NEWS FROM THE STATE ASSEMBLY TODAY!", summary: "" }));
  assert.match(c, /Too many capital letters/);
  assert.match(c, /exclamation/);
  assert.match(c, /clickbait/);
});

test("an empty intro is a red warning and a long intro shows what Google will show", () => {
  assert.match(text(seoChecks({ headline: "Tripura: Something Happened Today in Agartala", summary: "" })), /bad:The intro is empty/);
  assert.match(text(seoChecks({ headline: "Tripura: Something Happened Today in Agartala", summary: "word ".repeat(60) })), /first ~155 characters/);
});

test("nothing written yet asks for the headline", () => {
  assert.deepEqual(seoChecks({}).map((x) => x.level).slice(0, 1), ["bad"]);
});
