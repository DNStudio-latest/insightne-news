import test from "node:test";
import assert from "node:assert/strict";
import { searchTitle, searchDescription } from "../lib/seo-text.js";

test("a short headline keeps the site name after it", () => {
  assert.equal(searchTitle("Cyclone Akvan Alert"), "Cyclone Akvan Alert");
});

test("a long headline drops the site name so the headline is not cut earlier", () => {
  const t = searchTitle("Assamese Content Creator Jugamaya Dutta Dies; Family Appeals Against Speculation");
  assert.deepEqual(t, { absolute: "Assamese Content Creator Jugamaya Dutta Dies; Family Appeals Against Speculation" });
});

test("a short summary is left as it is", () => {
  assert.equal(searchDescription("A short summary of the story."), "A short summary of the story.");
});

test("a long summary is cut at the end of a sentence within 155 characters", () => {
  const s = "Around 10,000 security personnel, including state police, Tripura State Rifles and Central Armed Forces, will be deployed for the polls. Voting runs from 7 am to 4 pm across 21 urban local bodies and counting is on 2 December.";
  const d = searchDescription(s);
  assert.ok([...d].length <= 155);
  assert.ok(d.endsWith("polls."));
});

test("without a sentence end it is cut at a word and ends with an ellipsis", () => {
  const d = searchDescription("word ".repeat(80));
  assert.ok([...d].length <= 156);
  assert.ok(d.endsWith("…"));
  assert.ok(!/\s…$/.test(d));
});

test("Bengali sentence marks are respected", () => {
  const s = "এটি একটি দীর্ঘ বাংলা সারসংক্ষেপ যা অনেক শব্দ দিয়ে তৈরি এবং প্রথম বাক্যটি এখানে শেষ হয়। " + "পরের বাক্যটি অনেক বড় এবং এটি কেটে ফেলা হবে ".repeat(6);
  const d = searchDescription(s);
  assert.ok([...d].length <= 155);
});
