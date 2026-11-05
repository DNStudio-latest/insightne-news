import { test } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import {
  findCitations, findQuotes, authorText, classifyParagraphs, paragraphsFromText, docxParagraphs, readDocx, unzip,
  academicSuggestions, voiceProfile, analyseThesis, applyAlternative, EXCESS_WORDS, VOICE_NORMS, THESIS_DISCLAIMER,
} from "../public/ai-tools/academic.js";
import { ACADEMIC_MODEL } from "../public/ai-tools/model-academic.js";
import { editLikeAcademicEditor, integrityNotes, safeOutsideProtected, systemFor, ACADEMIC_SYSTEM, MAX_INPUT_CHARS } from "../lib/academic-editor.js";
import { excessRatios } from "../scripts/thesis-words.js";
import { cutToLength, cleanAcademic, makeRepairer, abstractKey, splitFor, balance } from "../scripts/thesis-corpus.js";
import { thresholdForFpr, atThreshold } from "../scripts/thesis-train.js";

// ---------- citations, quotations and the author's own words ----------

test("citations in the common styles are found", () => {
  const t = "Framing shapes coverage (Entman, 1993; Scheufele & Tewksbury, 2007, p. 11). McCombs and Shaw (1972) found " +
    "the same [12], as did others [3–5] and Chomsky's (1988) model. Not a citation: (see Chapter 2).";
  const found = findCitations(t).map((c) => c.text);
  assert.ok(found.includes("(Entman, 1993; Scheufele & Tewksbury, 2007, p. 11)"));
  assert.ok(found.some((c) => c.startsWith("McCombs and Shaw (1972)")));
  assert.ok(found.includes("[12]") && found.includes("[3–5]"));
  assert.ok(!found.some((c) => c.includes("Chapter 2")));
});

test("quotations of four words or more are found; short scare quotes are not", () => {
  const t = 'One editor said, “We never publish without a second source.” The ‘paid news’ problem persists.';
  const q = findQuotes(t).map((x) => x.text);
  assert.deepEqual(q, ["“We never publish without a second source.”"]);
});

test("the author's own text leaves out quotations, citations and URLs", () => {
  const own = authorText('Editors described the desk as “a place where every story is checked twice” (Interview, 2023). See https://example.org for details (Sen, 2019).');
  assert.equal(own, "Editors described the desk as. See for details.");
});

// ---------- the parts of a thesis ----------

test("headings, quotations, captions, lists and the reference list are told apart", () => {
  const paras = paragraphsFromText([
    "CHAPTER 2",
    "Review of Literature",
    "Newspapers in Tripura have grown since the 1990s, and their ownership has changed in ways that matter for how local politics is reported.",
    "“We report what the party office tells us, because there is no time to check,” said one reporter.",
    "Respondent 4: The editor decides everything.",
    "Table 2.1: Circulation of dailies in Agartala",
    "• Daily Desher Katha",
    "References",
    "Entman, R. M. (1993). Framing: Toward clarification of a fractured paradigm. Journal of Communication, 43(4), 51–58.",
    "Newspaper reports",
    "Tripura Times. (2019, March 3). Election coverage.",
    "Appendix A",
    "Interview schedule for reporters, used in all districts of the state between 2021 and 2022.",
  ].join("\n\n"));
  const kinds = classifyParagraphs(paras).map((p) => p.kind);
  assert.deepEqual(kinds, ["heading", "heading", "prose", "quote", "quote", "caption", "list", "heading", "reference", "heading", "reference", "heading", "prose"]);
});

// ---------- Word files ----------

// A minimal .docx: a ZIP with word/document.xml (deflated) and word/styles.xml (stored).
function makeDocx(documentXml, stylesXml) {
  const files = [
    { name: "word/document.xml", data: Buffer.from(documentXml), method: 8 },
    { name: "word/styles.xml", data: Buffer.from(stylesXml), method: 0 },
  ];
  const locals = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const body = f.method === 8 ? deflateRawSync(f.data) : f.data;
    const name = Buffer.from(f.name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(f.method, 8);
    lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(f.data.length, 22); lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, body);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(f.method, 10);
    ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(f.data.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  const all = Buffer.concat([...locals, cd, end]);
  return all.buffer.slice(all.byteOffset, all.byteOffset + all.length);
}

const DOC_XML = `<?xml version="1.0"?><w:document xmlns:w="x"><w:body>
<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Introduction</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Local news &amp; </w:t></w:r><w:r><w:t>politics</w:t></w:r><w:del><w:r><w:delText>deleted words</w:delText></w:r></w:del><w:r><w:tab/><w:t>matter.</w:t></w:r></w:p>
<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Cell text</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
<w:p/>
</w:body></w:document>`;
const STYLES_XML = `<w:styles><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style></w:styles>`;

test("a Word .docx file is read: styles, runs, tables; deleted tracked changes are left out", async () => {
  const paras = await readDocx(makeDocx(DOC_XML, STYLES_XML));
  assert.deepEqual(paras.map((p) => [p.text, p.style, p.table]), [
    ["Introduction", "heading 1", false],
    ["Local news & politics matter.", "", false],
    ["Cell text", "", true],
    ["", "", false],
  ]);
  assert.equal(classifyParagraphs(paras)[0].kind, "heading");
});

test("a file that is not a ZIP gets a clear message", async () => {
  await assert.rejects(unzip(new Uint8Array([1, 2, 3]).buffer, ["word/document.xml"]), /not a Word \.docx file/);
  assert.equal(docxParagraphs("<w:p><w:r><w:t>Hi</w:t></w:r></w:p>")[0].text, "Hi");
});

// ---------- suggestions ----------

test("rising style words are flagged with their ratio and plain alternatives, never inside quotations", () => {
  const text = 'This chapter delves into the intricate interplay between ownership and news, showcasing its effects. One editor said, "we are showcasing every rumour before printing it."';
  const s = academicSuggestions(text);
  const show = s.find((x) => x.kind === "excess" && x.phrase === "showcasing");
  assert.equal(show.ratio, EXCESS_WORDS.showcasing);
  assert.ok(show.alternatives.includes("showing"));
  assert.equal(s.filter((x) => x.kind === "excess" && x.phrase === "showcasing").length, 1, "the quoted word is left alone");
  const delves = s.find((x) => x.phrase === "delves into");
  assert.equal(delves.kind, "wordy", "a fixed replacement wins over a second flag on the same word");
  assert.ok(!s.some((x) => x.kind === "excess" && x.phrase === "delves"));
  assert.ok(s.some((x) => x.kind === "pattern" && /interplay/.test(x.excerpt)));
  assert.ok(applyAlternative(text, delves, "examines").startsWith("This chapter examines the intricate"));
});

test("claims about the literature without a citation are flagged; with one they are not", () => {
  const bare = academicSuggestions("Many scholars argue that regional newspapers depend on government advertising for survival.");
  assert.ok(bare.some((x) => x.kind === "source"));
  const cited = academicSuggestions("Many scholars argue that regional newspapers depend on government advertising (Ninan, 2007; Jeffrey, 2000).");
  assert.ok(!cited.some((x) => x.kind === "source"));
});

test("overclaiming, wordy phrases and stock formulas get advice", () => {
  const s = academicSuggestions("This study aims to explore how news is made. The survey proves that readers trust print. In order to test this, a sample was drawn. Social media plays a crucial role in news.");
  const kinds = new Set(s.map((x) => x.kind));
  for (const k of ["pattern", "overclaim", "wordy"]) assert.ok(kinds.has(k), k);
  assert.deepEqual(s.find((x) => x.kind === "wordy").alternatives, ["to"]);
});

// ---------- the writer's voice ----------

test("voice profile counts hedges, self-mention, frame markers and citations per 1,000 words", () => {
  const v = voiceProfile("I argue that coverage may reflect ownership (Sen, 2019). This study finds that it clearly does. We suggest caution.");
  assert.ok(v.rates.hedges > 0 && v.rates.selfMention > 0 && v.rates.frameMarkers > 0 && v.rates.boosters > 0);
  assert.ok(v.rates.citations > 0);
  assert.ok(VOICE_NORMS && VOICE_NORMS.human.n > 100 && VOICE_NORMS.ai.n > 100, "norms are generated from the corpus");
});

// ---------- the whole document with the trained model ----------

const AI_PARA = "This chapter delves into the multifaceted landscape of regional journalism, highlighting the pivotal role that local newspapers play in fostering democratic engagement. Furthermore, it underscores the intricate interplay between media ownership and editorial independence, offering valuable insights into the challenges faced by journalists. By examining these dynamics, the study provides a comprehensive understanding of how news organisations navigate the complexities of political pressure, commercial interests and evolving audience expectations in the digital age.";
const HUMAN_PARA = "I spent four months at the district desk of a Bengali daily in Agartala in 2019. Most mornings began with a call from the bureau chief, who read out the stories he wanted and the ones he did not. Two reporters told me they no longer filed on land disputes because the paper had lost an advertiser after one such report. I could not verify that claim from the accounts, so I treat it here as their perception, not as a fact, and return to it in Chapter 5.";

test("the academic model scores machine-written prose higher than a researcher's own fieldwork paragraph", () => {
  const r = analyseThesis(paragraphsFromText(["Chapter 1", AI_PARA, HUMAN_PARA, "References", "Sen, A. (2019). A book. Delhi: Press."].join("\n\n")), ACADEMIC_MODEL);
  const [ai, human] = r.paragraphs.filter((p) => p.kind === "prose");
  assert.ok(ai.score > human.score, `${ai.score} > ${human.score}`);
  assert.equal(ai.band, "ai");
  assert.notEqual(human.band, "ai");
  assert.equal(r.paragraphs.find((p) => p.text.startsWith("Sen, A.")).kind, "reference");
  assert.ok(r.summary.scoredWords > 100 && r.sections.length === 1 && r.sections[0].title === "Chapter 1", "empty sections such as the reference list are not listed");
  assert.ok(ACADEMIC_MODEL.thresholds.high > 0.5 && ACADEMIC_MODEL.training.test_metrics.n > 1000);
  assert.match(THESIS_DISCLAIMER, /not proof/);
});

// ---------- the academic editor ----------

const PASSAGE = 'Local newspapers play a pivotal role in Tripura (Sen, 2019). One reporter said, “We print the party line.”\n\nThe survey of 120 readers suggests that trust is falling.';

test("the editor's instructions forbid new facts and citations and protect quotations", () => {
  assert.match(ACADEMIC_SYSTEM, /never add anything/i);
  assert.match(ACADEMIC_SYSTEM, /Never invent a\s+citation/);
  assert.match(ACADEMIC_SYSTEM, /word for word/);
  assert.match(systemFor("thorough"), /THOROUGH/);
  assert.match(systemFor("anything"), /LIGHT/);
});

test("an edit comes back with notes from the safety nets when citations, quotes or figures change", async () => {
  const r = await editLikeAcademicEditor(PASSAGE, {
    generate: async (system, text) => {
      assert.ok(text.includes(PASSAGE));
      return JSON.stringify({
        edited: 'Local newspapers shape politics in Tripura (Sen, 2020). One reporter said, “We print the line.” In order to check, 150 readers were asked.\n\nThe survey suggests that trust is falling.',
        notes: ["Which districts?"],
        changes: ["'play a pivotal role' -> 'shape'"],
      });
    },
  });
  const notes = r.notes.join("\n");
  assert.match(notes, /not in the edit: \(Sen, 2019\)/);
  assert.match(notes, /in the edit but not in your text: \(Sen, 2020\)/);
  assert.match(notes, /quotations were changed/);
  assert.match(notes, /150/);
  assert.ok(r.notes.includes("Which districts?"));
  assert.ok(r.edited.includes("To check"), "safe replacement applied outside quotes");
});

test("a faithful edit raises no safety-net notes", () => {
  assert.deepEqual(integrityNotes(PASSAGE, 'Local newspapers shape politics in Tripura (Sen, 2019). One reporter said, "We print the party line."\n\nThe survey of 120 readers suggests that trust is falling.'), []);
});

test("automatic corrections never touch quotations or citations", () => {
  assert.equal(safeOutsideProtected('In order to win, he said “in order to win we lie” (In order to, 2019).'), 'To win, he said “in order to win we lie” (In order to, 2019).');
});

test("the editor refuses empty and over-long passages and needs an AI key", async () => {
  await assert.rejects(editLikeAcademicEditor("  ", { generate: async () => "{}" }), /Paste a passage/);
  await assert.rejects(editLikeAcademicEditor("x".repeat(MAX_INPUT_CHARS + 1), { generate: async () => "{}" }), /too long/);
  await assert.rejects(editLikeAcademicEditor("text", { provider: null }), /No AI key/);
  await assert.rejects(editLikeAcademicEditor("text", { generate: async () => "not json" }), /expected format/);
});

// ---------- corpus and training helpers ----------

test("corpus helpers: length matching, cleaning, word repair, grouping, balance", () => {
  const long = Array.from({ length: 30 }, (_, i) => `Sentence number ${i} has exactly seven words.`).join(" ");
  const cut = cutToLength(long, 70);
  assert.ok(cut.split(" ").length <= 77 && cut.endsWith("."));
  assert.equal(cleanAcademic("Abstract: Text here. © 2019 Elsevier Ltd. All rights reserved."), "Text here.");
  const repair = makeRepairer(Array.from({ length: 30 }, () => "the model is presented here and the state space"));
  assert.equal(repair("The state space of themodel ispresented"), "The state space of the model is presented");
  assert.equal(abstractKey("A b, C!"), abstractKey("ab c"));
  assert.ok(["train", "dev", "test"].includes(splitFor("x")));
  const rows = [{ domain: "d", label: "ai", text: "1" }, { domain: "d", label: "ai", text: "2" }, { domain: "d", label: "human", text: "3" }];
  assert.equal(balance(rows).length, 2);
});

test("the AI-like threshold keeps false positives at or below the target", () => {
  const scores = [0.1, 0.2, 0.3, 0.4, 0.95, 0.6, 0.7, 0.8, 0.9, 0.99];
  const labels = [0, 0, 0, 0, 0, 1, 1, 1, 1, 1];
  const th = thresholdForFpr(scores, labels, 0.2);
  assert.ok(atThreshold(scores, labels, th).falsePositiveRate <= 0.2);
});

test("excess-word ratios are computed from the yearly counts", () => {
  const words = 'idx,"word","type"\n0,"delves","style"\n1,"covid","content"\n2,"the","style"\n';
  const counts = "word,2022,2023,2024\ndelves,10,100,500\ncovid,10,10,500\nthe,1000,1000,1000\n,1000,1000,1000\n";
  assert.deepEqual(excessRatios(words, counts), { delves: 50 });
});
