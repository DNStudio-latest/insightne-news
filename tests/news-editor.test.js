import { test } from "node:test";
import assert from "node:assert/strict";
import { editLikeSeniorEditor, editorProvider, newNumbers, EDITOR_SYSTEM, MAX_INPUT_CHARS } from "../lib/news-editor.js";

const REPORT =
  "In a major boost for the state, the Tripura government on Tuesday rushed to approve a flood relief package of Rs 50 crore. " +
  "Chief Minister Manik Saha stated that 12,000 families will benefit.";

const reply = (obj) => async () => JSON.stringify(obj);

test("the style guide forbids new facts and asks for questions instead", () => {
  assert.match(EDITOR_SYSTEM, /never add a fact/i);
  assert.match(EDITOR_SYSTEM, /notes/);
  assert.match(EDITOR_SYSTEM, /Inverted pyramid/i);
  assert.match(EDITOR_SYSTEM, /sentence case/i);
});

test("an edit comes back with headline, body, notes and changes", async () => {
  let sent = "";
  const r = await editLikeSeniorEditor(REPORT, {
    generate: async (system, text) => {
      sent = text;
      return "```json\n" + JSON.stringify({
        headline: " Tripura approves Rs 50 crore flood relief for 12,000 families ",
        body: "The Tripura government on Tuesday approved a Rs 50 crore flood relief package.\n\nChief Minister Manik Saha said 12,000 families would benefit.",
        notes: ["Which districts are covered?"],
        changes: ["Moved the main fact to the lead", "Changed \"stated\" to \"said\""],
      }) + "\n```";
    },
  });
  assert.ok(sent.includes(REPORT), "the report is sent to the AI");
  assert.equal(r.headline, "Tripura approves Rs 50 crore flood relief for 12,000 families");
  assert.ok(r.body.startsWith("The Tripura government"));
  assert.deepEqual(r.notes, ["Which districts are covered?"]);
  assert.equal(r.changes.length, 2);
});

test("figures that appear only in the edit are flagged for checking", async () => {
  assert.deepEqual(newNumbers("Rs 50 crore for 12,000 families", "Rs 50 crore for 12000 families in 2026"), ["2026"]);
  const r = await editLikeSeniorEditor(REPORT, {
    generate: reply({ headline: "Tripura approves relief", body: "The package of Rs 75 crore was approved on Tuesday.", notes: [], changes: [] }),
  });
  assert.match(r.notes[0], /Check these figures.*75/);
});

test("empty, over-long and no-key requests are refused with a clear message", async () => {
  await assert.rejects(editLikeSeniorEditor("  ", { generate: reply({}) }), /Paste a report/);
  await assert.rejects(editLikeSeniorEditor("x".repeat(MAX_INPUT_CHARS + 1), { generate: reply({}) }), /too long/);
  await assert.rejects(editLikeSeniorEditor(REPORT, { provider: null }), /No AI key/);
});

test("an answer in the wrong format gives a friendly error", async () => {
  await assert.rejects(editLikeSeniorEditor(REPORT, { generate: async () => "Sorry, I cannot help." }), /expected format/);
  await assert.rejects(editLikeSeniorEditor(REPORT, { generate: reply({ headline: "x" }) }), /expected format/);
});

test("Claude is used when the site has a Claude key, otherwise Gemini", () => {
  assert.equal(editorProvider({ ANTHROPIC_API_KEY: "k", GEMINI_API_KEY: "g" }), "claude");
  assert.equal(editorProvider({ OPENROUTER_API_KEY: "k" }), "claude");
  assert.equal(editorProvider({ GEMINI_API_KEY: "g" }), "gemini");
  assert.equal(editorProvider({}), null);
});
