---
name: cinematic-news-documentary
description: Produce an InsightNE human-interest documentary news feature (full 16:9, short 16:9 and a vertical Reel) from an interview, photographs and supplied clips, with Hindi AI narration, English captions, map graphics, social copy and thumbnails. Use when the owner asks for a documentary, feature video, Reel or Short about a person or story from Tripura or Northeast India.
---

# Cinematic news documentary (InsightNE)

Worked example and code: `docs/soumee-sailesh-documentary/` (code in `code/`, lessons in `notes/reel_lessons.md`).
The owner is a journalist: plain English, accurate facts, no hype.

## Hard rules (owner's instructions)
1. **ElevenLabs credits.** Before any ElevenLabs job, give the estimated credit cost (use the tool's estimate-only option). Stop and get approval before any job or batch above 3,000 credits. Default to one take per section; redo only sections that fail checks. Test pronunciation of every proper noun with one short sentence before generating the rest. Use the existing cloned voice "DN News" for Hindi when it is available.
2. **No invented facts.** Use only the supplied brief, the interview and checked sources. Never add awards, dates, ages, quotes, release or box-office details, or drama such as "with no contacts". Say where the brief and the footage disagree instead of silently choosing.
3. **Quotation marks only for her actual words.** Interview in another language: translate for captions, mark unclear words `[check]`, and ask a native speaker to confirm.
4. **Credits follow the official source.** If an official song video lists more singers than the brief, show the official credit and say so. Never call her the only or lead singer.
5. **Film and song footage is copyrighted.** Short excerpts only, logos and handles left in, labelled "courtesy". Write a copyright review and a fallback edit without the footage. Do not claim it is cleared or copyright-free.
6. **Do not use AI narration or music that imitates a real song or person.** Disclose AI voice and AI music on the end card and in the description.
7. **Never overwrite supplied media.** Copy sources into the project, make them read-only.
8. **Do not commit media (videos, film clips, photos, audio, map data) to the website repo.** Commit text and code only. Merging to `main` publishes the site, so do that only when the owner says so.

## Workflow
1. Inspect the media (ffprobe, contact sheets). Identify the language of the interview and transcribe it in short windows if long stretches are skipped.
2. Write the brief's facts into a checklist; look up anything extra (place details, college name, district facts) and record the source.
3. Write the Hindi script section by section with matching English captions. Numbers as Hindi words for the voice. Avoid words the voice slurs; use common loanwords (for example "प्लेबैक सिंगर").
4. Estimate ElevenLabs cost, get approval if above 3,000 credits, generate, back-transcribe each take, pick the best, trim, find sentence boundaries.
5. Build the map (Natural Earth India point-of-view boundaries; straight-line distance by great circle, labelled approximate and aerial, rounded).
6. Edit three separate cuts. Do not crop one into another.
   - Full 16:9: 7 to 9 minutes, six chapters, interview in her own voice across the chapters.
   - Short 16:9: 60 to 90 seconds, for YouTube and Facebook only.
   - Vertical: under 60 seconds (aim 30 to 35 for Reels), her face and voice in the first 3 seconds, no still or text-only shot over 3 seconds, one idea per card, a question or share prompt at the end, credits in the caption.
7. Mix: narration clear, interview natural, music ducked under speech, loudness about -14 LUFS, true peak under -1 dB.
8. Captions: English, sentence case, no overlaps, at most 21 characters per second, at most 2 lines, inside platform safe areas.
9. Quality control before delivery: duration and resolution with ffprobe, black and frozen frame detection, loudness, lip sync check against the source, contact sheets read frame by frame, caption checks. Say plainly that a person must still watch each file once with sound.
10. Deliver: three videos, SRT files, Hindi scripts, interview transcript, thumbnails (her own portraits, not film stills), full social copy (YouTube, Facebook, Instagram, with complete credits and placeholders for unknown names), editorial notes, copyright review, export report, asset inventory.

## Platform notes
- Post the vertical to Instagram Reels, YouTube Shorts and Facebook Reels. Keep 16:9 for YouTube and the Facebook feed. (A reviewed Reel was the 16:9 short by mistake; label files clearly.)
- Instagram captions: no clickable links ("link in bio"). Facebook: first two lines carry the keywords. YouTube: tick the altered or synthetic content box for AI narration.
- The workspace is temporary: tell the owner to download the files or copy them to Drive.
