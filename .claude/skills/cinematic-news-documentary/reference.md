# Reference: what the owner taught in the first session (Soumee Sailesh documentary, 22-25 Nov 2026)

Read this together with SKILL.md. Everything here came from the owner's instructions, corrections or reviews, or from problems found while building.

## 1. Owner's standing preferences
- Writing: clear, factual, natural English; inverted pyramid; sentence-case headlines; attribute claims; no hype or clichés. Local Tripura context and accurate names, designations and places.
- Work approach: inspect existing files first; minimal targeted changes; never overwrite, delete or publish without understanding the impact; say what was tested and what was not; never claim done without verifying.
- Never fabricate quotations, statistics or sources. Say when something is unconfirmed.
- Branding: InsightNE. Look: deep blue, white, restrained gold, small red accent; bold sans-serif; clean broadcast lower thirds; no flashy effects.
- Languages: full and short 16:9 videos use Hindi AI narration with English captions. The vertical Reel uses her original audio with English captions (no Hindi voice-over unless asked).

## 2. Spending and approvals (strict)
- The owner objected that about 13,600 ElevenLabs credits were spent without telling them. Rule: tell them the estimated credits first; get approval before any job or batch over 3,000 credits.
- Where the cost went: speech 2 takes per section (about 4,800 wasted), music 4 tracks (3,936), rework after a pronunciation problem (1,607).
- Pass `generations_count: 1` on every speech call (default is 2) and on music (default is 4). Use `estimate_only` first. Test one short sentence with all proper nouns before the full script.
- Generated audio URLs expire; download straight away.
- Do not install tools (for example Firecrawl) unless the owner says so; they declined it. Scraping full publisher articles conflicts with the site's copyright rule (short summaries only).

## 3. Things the owner had to ask for twice: deliver these without being asked
1. Complete platform copy with credits: title, full description, chapter timestamps, song details, credits block, language note, About InsightNE, disclaimer, hashtags and tags, for YouTube (full, short, Shorts), Facebook (long, short, SEO version) and Instagram (Reel long and short, feed post). Mark unknown names as `[Name]` placeholders.
2. The SRT caption files (full, short, vertical) as separate attachments, with upload instructions (YouTube Subtitles; Facebook needs `.en_US.srt`). Note that burned-in captions plus an uploaded track can show twice.
3. Thumbnails: YouTube 1280x720 (two options), YouTube short, Facebook 1200x630, vertical cover 1080x1920. Use her own portraits, never film stills. Keep text clear of her face.
4. A short summary of what is verified and what is not, and a reminder that the workspace is temporary (download files).
5. Label which file goes where. The 16:9 short was posted as an Instagram Reel by mistake; the vertical was made for Reels.

## 4. Instagram review lessons (Reel posted 23 Nov, 4K likes and 71 comments reported)
Right: "From Tripura to Bollywood" hook, collab post with her account, clear credits and subtitles, emotional story arc.
Wrong for Reels: long (77 s), static photo 6 s, map 10 s, black credits card 13 s, her voice only at 0:41, no call to action, long song excerpts, flat narration, too much text.
Fix: 30-35 s cut; her face and voice in the first 3 s; max 3 s per still; credits in the caption; end with a question ("Share this with someone from Khowai"); pinned comment; a follow-up post.
Do not copy from the review: invented drama ("no contacts in Mumbai"), "her singing" clip (none exists), unverified retention claims; check Instagram Insights.

## 5. Editorial lessons
- The brief and the official source can differ (the song video credits Javed Ali, Mohd Danish and Soumee Sailesh; the brief named Javed Ali only). Follow the official credit and flag it.
- The interview may not be in the language assumed (it was Bengali, not Hindi) and may not contain the points in the brief. Use brief points only as attributed narration or plain cards, never in quotation marks.
- Check names against official sources (college's full name; constituency naming). If unsure, leave it out and flag it.
- Explain playback singing in one line so viewers do not take the film's actors for her.
- Added context must be verified and recorded (for example Khowai district formed 2012; S.D. Burman and R.D. Burman).
- Do not present one film credit as proof she is a nationally established singer.

## 6. Hindi narration
- Voice: cloned voice named "DN News" (Hindi), model eleven_v4. Find it by name with the voice list tool.
- "पार्श्वगायन/पार्श्वगायिका" was slurred; "प्लेबैक सिंगर / प्लेबैक सिंगिंग" worked. Write numbers as words ("दो हज़ार सत्रह"). A.R. Rahman and all other names tested correctly.
- Check each take by transcribing it back (Whisper large-v3) and scoring against the script; ASR writes English words and digits in Latin script, so low scores can be harmless.
- Background music: instrumental score from ElevenLabs Music; check for vocals; disclose on the end card.

## 7. Technical lessons (code in docs/soumee-sailesh-documentary/code/)
- Whisper skipped long stretches of the Bengali interview; use VAD plus short overlapping windows and cross-check with silence detection.
- Python `\w` does not match Hindi vowel signs; do not strip punctuation with it.
- Pillow: drawing translucent shapes with `ImageDraw.Draw(img, "RGBA")` on an RGBA image replaces pixels instead of blending. Draw on a separate layer and `alpha_composite`.
- Do not name a scene's timeline position `start` if it is also the source seek point.
- Freeze detection found graphic cards that sat still for 4-7 s; a slow continuous push-in fixed it.
- Loudness: two-pass `loudnorm` to -14 LUFS / -1.5 dBTP gave -14.1 LUFS and -1.3 dBTP. AAC adds about 25 ms; lip sync is fine within one frame.
- Check the vertical duration programmatically (under 60 s). The long documentary rendered with 4 processes in roughly half an hour; reuse unchanged scene renders with the `ONLY` option.
- The sandbox blocked Google Fonts and jsDelivr; use installed fonts (Inter, DejaVu Serif). Natural Earth data came from raw.githubusercontent.com; Nominatim was blocked.
- Distances: great-circle from Khowai town to Mumbai is 2,012 km; show "about 2,000 km", labelled approximate aerial distance.
- The owner's PC folder `C:\Users\debna\my-video` was listed but not offered to cloud sessions; files must be downloaded or moved by the owner unless the Claude app on that PC is updated.

## 8. Repo and publishing rules
- This repository deploys the website from `main` to Vercel. Work on a branch, commit text and code only, open a pull request, merge only when the owner says to publish.
- Never commit videos, film clips, photos, audio or large map data to this repository. Keep media in Google Drive or on the production computer.
- Documentary records for the first project are in `docs/soumee-sailesh-documentary/`.

## 9. YouTube review lessons (full documentary, 25 Nov 2026)
Details in `docs/soumee-sailesh-documentary/notes/youtube_review_lessons.md`.
- A reviewer may be reading the description, not watching the film (it said 6 minutes for a 7:03 video). Check its claims before acting.
- Ask the subject early: which part she sang, how she was chosen. A breakthrough story needs it; never guess.
- Narration flatness was raised in two reviews: plan expressive narration, especially the ending; estimate credits first and tell the owner.
- Plan a second voice (teacher, parent, fellow musician), more music-making visuals and a "what next" ending.
- Fill every credit placeholder before posting; check the live description for leftover brackets.
