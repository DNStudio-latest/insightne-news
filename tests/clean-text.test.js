import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanText, cleanStoryText } from "../lib/clean-text.js";

test("hidden characters are removed from English text", () => {
  assert.equal(cleanText("Tripura​ polls﻿ on 5 December⁠"), "Tripura polls on 5 December");
  assert.equal(cleanText("in­visible ‮mark‬"), "invisible mark");
  assert.equal(cleanText("tag\u{E0041}\u{E0042} text"), "tag text");
  assert.equal(cleanText("zero‍width joiner"), "zerowidth joiner");
});

test("joiners inside Bengali and Hindi words are kept", () => {
  const bengali = "র‍্যাব"; // র‍্যাব: the joiner is part of the spelling
  const hindi = "क्‍ष";
  assert.equal(cleanText(bengali), bengali.normalize("NFC"));
  assert.equal(cleanText(hindi), hindi.normalize("NFC"));
  assert.equal(cleanText("আগরতলা​ শহর"), "আগরতলা শহর");
});

test("all story text fields are cleaned, other fields untouched", () => {
  const out = cleanStoryText({
    headline: "A​b",
    summary: "c﻿",
    region: "Tripura",
    score: 8,
    author: null,
    translations: { hi: { headline: "ख​ग" } },
    gallery: [{ url: "x.webp", caption: "cap⁠" }],
  });
  assert.deepEqual(out, { headline: "Ab", summary: "c", region: "Tripura", score: 8, author: null, translations: { hi: { headline: "खग" } }, gallery: [{ url: "x.webp", caption: "cap" }] });
  assert.deepEqual(cleanStoryText({ status: "approved" }), { status: "approved" });
});
