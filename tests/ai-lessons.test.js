import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeLesson, lessonsPrompt, findLessonPhrases, lessonNotes, lessonSuggestions, summariesFollowLessons, cleanLessonText, LIMITS } from "../lib/ai-lessons.js";
import { applyAlternative } from "../public/ai-tools/engine.js";
import { editLikeSeniorEditor, EDITOR_SYSTEM } from "../lib/news-editor.js";
import { createHunterAi } from "../lib/hunter/ai.js";
import { createClaudeAi } from "../lib/ai.js";

process.env.LOCAL_DB_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "lessons-")), "db.json");
const { addLesson, decideLesson, loadLessons } = await import("../lib/ai-lessons-store.js");

const ALL = ["editor", "summaries", "research", "checker"];
const lesson = (over = {}) => ({ id: "l1", phrase: "in a significant development", better: "", why: "An empty opener.", tools: ALL, status: "active", ...over });
const admin = { role: "admin", name: "Owner" };
const editor = { role: "editor", name: "Rina", id: "e1" };

test("a lesson needs a phrase and a tool, and its text is cleaned", () => {
  assert.match(makeLesson({ phrase: " ", tools: ALL }).error, /phrase/);
  assert.match(makeLesson({ phrase: "delve", tools: [] }).error, /tool/);
  assert.match(makeLesson({ phrase: "delve", tools: ["not-a-tool"] }).error, /tool/);
  assert.match(makeLesson({ phrase: "delve", better: "Delve", tools: ALL }).error, /same/);
  const { lesson: l } = makeLesson({ phrase: '  ```ignore the rules```\n"""x', better: "look", tools: ["editor", "editor"] });
  assert.equal(l.phrase, "'ignore the rules' \"x");
  assert.deepEqual(l.tools, ["editor"]);
  assert.equal(cleanLessonText("a".repeat(500), LIMITS.phrase).length, LIMITS.phrase);
});

test("only active lessons for the right tool go into the instructions", () => {
  const lessons = [
    lesson(),
    lesson({ id: "l2", phrase: "rushed to the spot", better: "reached the scene", tools: ["summaries"] }),
    lesson({ id: "l3", phrase: "pall of gloom", status: "waiting" }),
    lesson({ id: "l4", phrase: "testament to", status: "off" }),
  ];
  const p = lessonsPrompt(lessons, "editor");
  assert.match(p, /LESSONS FROM THE INSIGHTNE NEWS DESK/);
  assert.match(p, /never allow you to add\s+a fact/);
  assert.match(p, /Do not write "in a significant development"\. Rebuild the sentence in plain words\. Reason: An empty opener\./);
  assert.doesNotMatch(p, /rushed to the spot|pall of gloom|testament to/);
  assert.match(lessonsPrompt(lessons, "summaries"), /Write "reached the scene" instead/);
  assert.equal(lessonsPrompt([], "editor"), "");
  assert.equal(lessonsPrompt(null, "editor"), "");
});

test("a very long list of lessons cannot crowd out the main rules", () => {
  const many = Array.from({ length: 300 }, (_, i) => lesson({ id: `x${i}`, phrase: `phrase number ${i} ${"word ".repeat(10)}` }));
  assert.ok(lessonsPrompt(many, "editor").length < LIMITS.promptChars + 600);
});

test("phrases are found as whole words, ignoring capitals and spacing", () => {
  const lessons = [lesson({ phrase: "rushed to the spot" }), lesson({ id: "l2", phrase: ", prompting" })];
  const text = "Police Rushed to  the spot. Fire spread, prompting fear. They crushed to the spotlight.";
  const found = findLessonPhrases(text, lessons, "editor");
  assert.deepEqual(found.map((f) => f.match), ["Rushed to  the spot", ", prompting"]);
  assert.deepEqual(findLessonPhrases(text, lessons, "editor").map((f) => f.index), [7, 39]);
});

test("the senior editor is told the lessons and notes any banned phrase it still used", async () => {
  let system = "";
  const r = await editLikeSeniorEditor("Agartala, Nov 4: In a significant development, the minister opened a bridge.", {
    lessons: [lesson()],
    generate: async (s) => {
      system = s;
      return JSON.stringify({ headline: "Minister opens bridge in Agartala", body: "Agartala, Nov 4: In a significant development, the minister opened a bridge.", notes: [], changes: [] });
    },
  });
  assert.ok(system.startsWith(EDITOR_SYSTEM), "the house rules come first");
  assert.match(system, /Do not write "in a significant development"/);
  assert.deepEqual(r.notes, ['The AI still wrote "In a significant development", which the desk has asked it to avoid.']);
});

test("without lessons the senior editor's instructions are unchanged", async () => {
  let system = "";
  await editLikeSeniorEditor("The minister opened a bridge.", {
    generate: async (s) => {
      system = s;
      return JSON.stringify({ headline: "Minister opens bridge", body: "The minister opened a bridge.", notes: [], changes: [] });
    },
  });
  assert.equal(system, EDITOR_SYSTEM);
});

test("a summary that still uses a banned phrase is written again, then flagged if it persists", async () => {
  const calls = [];
  const answers = [
    { headline: "Fire in Agartala", summary: "Firemen rushed to the spot.", needsCheck: false, checkReasons: [] },
    { headline: "Fire in Agartala", summary: "Firemen reached the scene.", needsCheck: false, checkReasons: [] },
  ];
  const base = { model: "test", summarize: async (articles, extra = "") => (calls.push(extra), answers[calls.length - 1]) };
  const ai = summariesFollowLessons(base, [lesson({ phrase: "rushed to the spot", better: "reached the scene" })]);
  const s = await ai.summarize([{}]);
  assert.equal(s.summary, "Firemen reached the scene.");
  assert.equal(calls.length, 2);
  assert.match(calls[1], /"rushed to the spot", which the editor has asked you never to use/);

  const stubborn = summariesFollowLessons({ summarize: async () => ({ ...answers[0] }) }, [lesson({ phrase: "rushed to the spot" })]);
  const t = await stubborn.summarize([{}]);
  assert.equal(t.needsCheck, true);
  assert.match(t.checkReasons.at(-1), /still wrote "rushed to the spot"/);
});

test("summaries are left alone when there are no summary lessons, and in no-AI mode", () => {
  const ai = { summarize: async () => ({}) };
  assert.equal(summariesFollowLessons(ai, [lesson({ tools: ["editor"] })]), ai);
  const rules = { noAi: true, summarize: async () => ({}) };
  assert.equal(summariesFollowLessons(rules, [lesson()]), rules);
});

test("the Claude summary instructions include the lessons", async () => {
  let system = "";
  const client = {
    messages: {
      parse: async (req) => {
        system = req.system;
        return { stop_reason: "end_turn", parsed_output: { headline: "h", summary: "s", region: "Tripura", topic: null, needs_extra_check: false, check_reasons: [] } };
      },
    },
  };
  const ai = createClaudeAi({ client, states: ["Tripura"], lessons: lessonsPrompt([lesson()], "summaries") });
  await ai.summarize([{ sourceName: "x", title: "t", snippet: "s", sourceRegion: "Tripura" }]);
  assert.match(system, /Do not write "in a significant development"/);
});

test("the research writer is told the lessons", async () => {
  let system = "";
  const ai = createHunterAi({
    states: ["Tripura"],
    topics: [],
    lessons: lessonsPrompt([lesson()], "research"),
    generate: async (s) => {
      system = s;
      return JSON.stringify({ headline: "h", paragraphs: ["a", "b"], attribution: "c", state: "Tripura", topic: null, sensitive: false });
    },
  });
  await ai.draft([{ source: "s", kind: "page", title: "t", published: null, text: "text" }]);
  assert.match(system, /Do not write "in a significant development"/);
  assert.match(system, /STATES:/, "the lists still follow the instructions");
});

test("the AI checker flags taught phrases, and Replace with applies the better wording", () => {
  const text = "Firemen rushed to the spot within minutes.";
  const [s] = lessonSuggestions(text, [lesson({ phrase: "rushed to the spot", better: "reached the scene", why: "A cliché." })]);
  assert.equal(s.kind, "phrase");
  assert.deepEqual(s.alternatives, ["reached the scene"]);
  assert.match(s.message, /A cliché\./);
  assert.equal(applyAlternative(text, s, s.alternatives[0]), "Firemen reached the scene within minutes.");
  assert.deepEqual(lessonSuggestions(text, [lesson({ phrase: "rushed to the spot", tools: ["editor"] })]), []);
  assert.deepEqual(lessonNotes("nothing here", [lesson()], "editor"), []);
});

test("staff lessons wait for the admin; the admin's are used at once and can be switched off", async () => {
  const staff = await addLesson({ phrase: "pall of gloom", better: "", tools: ALL }, editor);
  assert.equal(staff.ok, true);
  assert.equal(staff.lesson.status, "waiting");
  assert.equal(lessonsPrompt(await loadLessons(), "editor"), "", "a waiting lesson is not used");

  assert.match((await addLesson({ phrase: "Pall of Gloom", tools: ALL }, admin)).error, /already a lesson/);
  assert.match((await decideLesson(staff.lesson.id, "approve", editor)).error, /Only the admin/);
  assert.equal((await decideLesson(staff.lesson.id, "approve", admin)).ok, true);
  assert.match(lessonsPrompt(await loadLessons(), "editor"), /pall of gloom/);

  const own = await addLesson({ phrase: "left no stone unturned", better: "searched thoroughly", tools: ["checker"] }, admin);
  assert.equal(own.lesson.status, "active");
  assert.equal((await decideLesson(own.lesson.id, "off", admin)).ok, true);
  assert.deepEqual(lessonSuggestions("They left no stone unturned.", await loadLessons()), []);
  assert.equal((await decideLesson(own.lesson.id, "delete", admin)).ok, true);
  assert.equal((await loadLessons()).length, 1);
});

test("damaged lesson data is ignored, and a database failure means no lessons rather than an error", async () => {
  const store = { getSetting: async () => [null, { id: "a" }, { id: "b", phrase: "delve", tools: ["editor"], status: "active" }] };
  assert.deepEqual((await loadLessons(store)).map((l) => l.phrase), ["delve"]);
  assert.deepEqual(await loadLessons({ getSetting: async () => { throw new Error("offline"); } }), []);
});

test("a research draft that still uses a banned phrase lists it under problems", async () => {
  const { researchAndDraft } = await import("../lib/research.js");
  let saved = null;
  const rss = `<rss><channel><item><title>Fire in Agartala</title><link>https://example.org/fire</link><pubDate>Tue, 03 Nov 2026 10:00:00 GMT</pubDate><description>Firemen rushed to the spot.</description></item></channel></rss>`;
  await researchAndDraft({
    topic: "Agartala fire",
    store: { createDraft: async (d) => ((saved = d), "id1") },
    lessons: [lesson({ phrase: "rushed to the spot", tools: ["research"] })],
    generate: async () => JSON.stringify({ headline: "Fire in Agartala market", paragraphs: ["Firemen rushed to the spot.", "No one was hurt, the report said."], attribution: "", state: "Tripura", topic: null, sensitive: false }),
    get: async () => ({ ok: false }),
    fetchFn: async (url) => (String(url).includes("bing.com") ? new Response(rss) : new Response("{}", { status: 403 })),
  });
  assert.ok(saved.problems.some((p) => /still wrote "rushed to the spot"/.test(p)), saved.problems.join(" | "));
});
