// The phone "News desk" (/admin/desk): the exact texts sent to Gemini and ChatGPT.
// These are the same words the Windows InsightNE News Tool uses. Do not add rules of your own here:
// ChatGPT gets only the fixed command plus the source material (the editor's own instruction).

export const CHATGPT_COMMAND = "Analyse and Write the news in english following my style.";

export const GEMINI_PROMPT =
  "Transcribe the Bengali speech in this audio with timestamps, then give an English translation with the same timestamps. " +
  "Write every timestamp as plain text at the start of its line, like 00:12 (no bold, no brackets). " +
  "If more than one audio file is attached, treat each as its own clip and label them Clip 1, Clip 2, and so on, in the order attached. " +
  "Mark unclear words [unclear].";

// The message pasted into ChatGPT: the command, the raw Bengali caption, who speaks (only if the editor typed it)
// and Gemini's reply (only if there was a clip).
export function chatGptMessage(item) {
  let msg = `${CHATGPT_COMMAND}\n\nRaw Bengali caption (WhatsApp):\n${String(item.caption_bn || "").trim()}`;
  const speakers = String(item.speakers || "").trim();
  if (speakers) msg += `\n\nWho is speaking in the clip (given by the editor):\n${speakers}`;
  const gem = String(item.gemini_text || "").trim();
  if (gem) msg += `\n\nGemini output (Bengali transcript and English):\n${gem}`;
  return msg;
}
