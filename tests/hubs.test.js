import { test } from "node:test";
import assert from "node:assert/strict";
import { allHubs, hubBySlug, storyInHub, hubsForStory, relatedStories } from "../lib/hubs.js";

const s = (id, headline, extra = {}) => ({ id, headline, summary: "", region: "Tripura", topic: null, ...extra });

test("the civic polls hub is defined with checked dates and matches its stories", () => {
  const hub = hubBySlug("tripura-civic-polls");
  assert.ok(hub && allHubs().length >= 1);
  assert.ok(hub.facts.length >= 5 && hub.facts.every((f) => f.date && f.text));
  assert.ok(storyInHub(s("1", "Agartala Municipal Corporation election: 51 wards"), hub));
  assert.ok(storyInHub(s("2", "Nominations open", { summary: "The State Election Commission said nominations start today." }), hub));
  assert.ok(!storyInHub(s("3", "Hailstorm in Shillong", { region: "Meghalaya" }), hub));
  assert.equal(hubsForStory(s("4", "Civic polls: Congress names candidates")).length, 1);
  assert.equal(hubBySlug("nope"), null);
});

test("related stories: shared headline words first, then the same region, never the story itself", () => {
  const story = s("a", "Ebola mock drill held at GB Hospital in Agartala");
  const pool = [
    story,
    s("b", "Mock drill for Ebola response at Tripura hospitals"),
    s("c", "Hailstorm disrupts traffic", { region: "Meghalaya" }),
    s("d", "Road repair begins in Udaipur"),
    s("e", "Rainfall warning for Sikkim", { region: "Sikkim" }),
  ];
  const out = relatedStories(story, pool, 3);
  assert.equal(out[0].id, "b");
  assert.ok(!out.some((x) => x.id === "a"));
  assert.ok(out.some((x) => x.id === "d")); // same region fills the rest
  assert.ok(!out.some((x) => x.id === "e"));
});
