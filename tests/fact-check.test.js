import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSummaryFacts } from "../lib/fact-check.js";

const sources = [
  "Chief Minister Manik Saha inaugurated a 40-bed hospital at Belonia on Monday",
  "The hospital in Belonia, built at a cost of Rs 12.5 crore, will serve nearly 3 lakh people, Saha said on 4 November.",
];

test("a brief that stays inside its sources passes", () => {
  const brief = { headline: "Saha opens new hospital in Belonia", summary: "Chief Minister Manik Saha inaugurated a 40-bed hospital at Belonia, built at Rs 12.5 crore. It will serve about 3 lakh people, he said on November 4." };
  assert.deepEqual(checkSummaryFacts(brief, sources), []);
});

test("a figure, month, name or quotation that the sources do not contain is listed", () => {
  const figure = checkSummaryFacts({ headline: "Hospital opens", summary: "A 60-bed hospital opened at Belonia." }, sources);
  assert.match(figure.join(" "), /"60"/);
  const month = checkSummaryFacts({ headline: "Hospital opens", summary: "Saha opened the hospital on 4 December." }, sources);
  assert.match(month.join(" "), /december/);
  const name = checkSummaryFacts({ headline: "Hospital opens", summary: "Saha opened the hospital with Sudip Roy at Belonia." }, sources);
  assert.match(name.join(" "), /"Sudip", "Roy"|"Sudip"/);
  const quote = checkSummaryFacts({ headline: "Hospital opens", summary: 'Saha said "this hospital will change lives in the south" at Belonia.' }, sources);
  assert.match(quote.join(" "), /quotation/);
});

test("number words in the brief match digits in the sources, and the reverse", () => {
  const src = ["Three BSF jawans were injured at Ashabari, 8 smugglers held"];
  assert.deepEqual(checkSummaryFacts({ headline: "Jawans hurt", summary: "3 jawans were injured and eight smugglers were held at Ashabari." }, src), []);
  assert.match(checkSummaryFacts({ headline: "Jawans hurt", summary: "Five jawans were injured at Ashabari." }, src).join(" "), /"5"/);
});

test("abbreviations, titles and sentence openers are not treated as invented names", () => {
  const src = ["BSF jawans attacked at Ashabari; CM assures action, police said"];
  assert.deepEqual(checkSummaryFacts({ headline: "Border Security Force jawans attacked", summary: "Police said the BSF personnel were attacked at Ashabari. The Chief Minister assured action." }, src), []);
});

test("names are not compared against Bengali sources, but figures still are", () => {
  const src = ["আগরতলায় ২০ জন আহত, মুখ্যমন্ত্রী মানিক সাহা"];
  assert.deepEqual(checkSummaryFacts({ headline: "Twenty hurt in Agartala", summary: "20 people were hurt in Agartala, Manik Saha said." }, src), []);
  assert.match(checkSummaryFacts({ headline: "Hurt in Agartala", summary: "35 people were hurt in Agartala." }, src).join(" "), /"35"/);
});

test("an empty brief or empty sources give no reasons", () => {
  assert.deepEqual(checkSummaryFacts({}, sources), []);
  assert.deepEqual(checkSummaryFacts({ headline: "x", summary: "A 60-bed hospital." }, []), []);
});

test("compound and scaled figures: thirty-five = 35, 15 thousand = Rs 15,000, 3 lakh = 300,000", () => {
  assert.deepEqual(checkSummaryFacts({ headline: "Phones recovered", summary: "Police recovered thirty-five phones worth Rs 15,000 each at Udaipur." }, ["35 mobile phones recovered at Udaipur, each worth 15 thousand rupees"]), []);
  assert.deepEqual(checkSummaryFacts({ headline: "Aid", summary: "The scheme will reach 300,000 people." }, ["The scheme will reach 3 lakh people"]), []);
  assert.deepEqual(checkSummaryFacts({ headline: "Aid", summary: "It will reach 3 lakh people." }, ["It will reach 300,000 people (3 lakh)"]), []);
  assert.match(checkSummaryFacts({ headline: "Aid", summary: "It will reach 4 lakh people." }, ["It will reach 3 lakh people"]).join(" "), /400000/);
  assert.deepEqual(checkSummaryFacts({ headline: "Aid", summary: "One of the schemes reached twenty-one blocks." }, ["A scheme reached 21 blocks"]), []);
});

test("a spelled-out name whose abbreviation is in the sources counts as found; a sentence opener alone is not a name", () => {
  assert.deepEqual(checkSummaryFacts({ headline: "Library opens", summary: "The minister opened a library at Indira Gandhi Government College. Readers can borrow books." }, ["Minister opens new library building at IGGC"]), []);
  assert.match(checkSummaryFacts({ headline: "Questions raised", summary: "Congress questioned Kiren Rijiju over the project." }, ["Congress questions Rijiju over the project"]).join(" "), /"Kiren"/);
});
