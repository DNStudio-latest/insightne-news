// The phone "News desk": the fixed ChatGPT command, the warnings and the item store.
import test from "node:test";
import assert from "node:assert/strict";
import { CHATGPT_COMMAND, GEMINI_PROMPT, chatGptMessage } from "../lib/desk-prompts.js";
import { deskWarnings } from "../lib/desk-checks.js";
import { saveItem, markItem, loadItems, deleteItem, getItem, textHash } from "../lib/desk-store.js";

function memoryStore() {
  let value = null;
  return { async getSetting() { return value; }, async setSetting(_k, v) { value = JSON.parse(JSON.stringify(v)); } };
}

test("the ChatGPT command is exactly the owner's words and nothing is added", () => {
  assert.equal(CHATGPT_COMMAND, "Analyse and Write the news in english following my style.");
  const m = chatGptMessage({ caption_bn: "বাংলা", speakers: "Dr X, Minister", gemini_text: "00:01 hello" });
  assert.ok(m.startsWith(`${CHATGPT_COMMAND}\n\nRaw Bengali caption (WhatsApp):\nবাংলা`));
  assert.ok(m.includes("Who is speaking in the clip (given by the editor):\nDr X, Minister"));
  assert.ok(m.includes("Gemini output (Bengali transcript and English):\n00:01 hello"));
  assert.equal(chatGptMessage({ caption_bn: "c" }), `${CHATGPT_COMMAND}\n\nRaw Bengali caption (WhatsApp):\nc`);
  assert.ok(GEMINI_PROMPT.includes("Clip 1, Clip 2"));
});

test("warnings: missing dateline, rupee sign, Belonia, speaker and photo caption", () => {
  const w = deskWarnings({ headline: "Short", intro: "Agartala, Nov 21: dated intro", story: "He said ₹5 lakh went to Bilonia.", speakers: "", photo_url: "/x.webp", photo_caption: "" });
  const text = w.rows.map((r) => r.what).join(" | ");
  assert.match(text, /does not start with a dateline/);
  assert.match(text, /Rupee symbol/);
  assert.match(text, /Belonia/);
  assert.match(text, /Nobody is recorded as the speaker/);
  assert.match(text, /photo caption is empty/);
  assert.match(text, /Intro starts with a dateline/);
  assert.ok(w.red > 0 && w.rows[0].level === "RED");
});

test("warnings: a story with a victim and a phone number is red; clean story has no legal rows", () => {
  const bad = deskWarnings({ headline: "A police said headline of eight words or more here", intro: "Short intro.", story: "Agartala, Nov 21: The rape victim called 9876543210.", photo_url: "/x" , photo_caption: "A hall"});
  assert.ok(bad.rows.some((r) => r.what.startsWith("Sexual offence")) && bad.rows.some((r) => r.what.startsWith("Phone number")));
  const clean = deskWarnings({ headline: "Government employees cast ballots ahead of the civic polls", intro: "Voting began.", story: "Agartala, Nov 21: Voting began at a school.\n\nTwo.\n\nThree.\n\nFour.", no_video: true, photo_url: "/x", photo_caption: "A hall" });
  assert.ok(!clean.rows.some((r) => r.area === "Legal" && /Sexual|Defamatory|Phone/.test(r.what)));
});

test("the store keeps fields, never loses other items and deletes only what is asked", async () => {
  const store = memoryStore();
  const a = await saveItem({ caption_bn: "one" }, { store });
  const b = await saveItem({ caption_bn: "two" }, { store });
  await saveItem({ id: a.id, headline: "H" }, { store });
  const items = await loadItems(store);
  assert.equal(items.length, 2);
  assert.equal((await getItem(a.id, store)).caption_bn, "one", "a field not sent is kept");
  assert.equal((await getItem(a.id, store)).headline, "H");
  await markItem(a.id, { draft_story_id: "s1", uploaded_hash: textHash(await getItem(a.id, store)) }, { store });
  const again = await saveItem({ id: a.id, story: "changed" }, { store });
  assert.equal(again.draft_story_id, "s1", "the server-only fields survive a save from the phone");
  assert.notEqual(textHash(again), again.uploaded_hash, "changing the text invalidates the upload hash");
  await saveItem({ id: b.id, draft_story_id: "hack", published: true }, { store });
  assert.equal((await getItem(b.id, store)).draft_story_id, undefined, "the phone cannot set the draft link or published flag");
  await deleteItem(b.id, store);
  assert.deepEqual((await loadItems(store)).map((i) => i.id), [a.id]);
});
