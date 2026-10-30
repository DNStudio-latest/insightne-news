import { test } from "node:test";
import assert from "node:assert/strict";
import { pickIndiaMatch, isIndiaMen } from "../lib/cricket.js";

const match = (over) => ({
  id: "1", name: "India vs Australia, 2nd ODI", matchType: "odi", status: "India need 45 runs in 30 balls", venue: "Wankhede, Mumbai",
  dateTimeGMT: "2026-10-29T08:00:00", teams: ["India", "Australia"],
  teamInfo: [{ name: "India", shortname: "IND", img: "i.png" }, { name: "Australia", shortname: "AUS", img: "a.png" }],
  score: [{ r: 289, w: 7, o: 50, inning: "Australia Inning 1" }, { r: 245, w: 4, o: 45, inning: "India Inning 1" }],
  matchStarted: true, matchEnded: false, ...over,
});

test("only India's senior men's team counts", () => {
  assert.ok(isIndiaMen(match()));
  for (const t of ["India Women", "India A", "India U19", "India Legends"]) assert.ok(!isIndiaMen(match({ teams: [t, "Australia"] })), t);
});

test("a live India match is picked and tidied", () => {
  const now = new Date("2026-10-29T12:00:00Z").getTime();
  const m = pickIndiaMatch([match({ id: "w", teams: ["India Women", "England"] }), match()], now, "");
  assert.equal(m.id, "1");
  assert.equal(m.live, true);
  assert.equal(m.type, "ODI");
  assert.deepEqual(m.innings.map((i) => [i.team, i.short, i.runs, i.wickets]), [["Australia", "AUS", 289, 7], ["India", "IND", 245, 4]]);
});

test("old matches are not shown", () => {
  const now = new Date("2026-11-05T12:00:00Z").getTime();
  assert.equal(pickIndiaMatch([match({ matchEnded: true })], now), null);
  assert.equal(pickIndiaMatch([], now), null);
});

test("the chosen opponent is followed: India vs New Zealand is shown, not India vs Pakistan", () => {
  const now = new Date("2026-10-29T12:00:00Z").getTime();
  const feed = [match({ id: "p", name: "India vs Pakistan", teams: ["India", "Pakistan"] }), match({ id: "nz", name: "India vs New Zealand", teams: ["India", "New Zealand"] })];
  assert.equal(pickIndiaMatch(feed, now, "New Zealand").id, "nz");
  assert.equal(pickIndiaMatch([feed[0]], now, "New Zealand"), null);
});
