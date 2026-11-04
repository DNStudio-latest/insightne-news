# 8. AI text checker and style editor

A research tool with two parts:

1. **Checker:** gives a 0–100 score for how likely a text is to be AI-generated. It shows the words, phrases and style measures behind the score.
2. **Style editor:** fixes wordy phrases automatically ("the majority of" → "most") and marks the sentences that read as AI-written. It also lists AI-typical words and patterns, with plainer options you can apply in one click.

All the work happens in the reader's browser. No text is sent to the website, to Claude or to any other service. The page is at **`/ai-tools/`** on the website (`https://www.insightnenews.in/ai-tools/`). It is hidden from search engines (`noindex`) and does not appear in the site menu.

## In the admin panel

Signed-in staff (admin, editors and sub-editors) also have the tool at **`/admin/ai-check`**: the **🤖 AI checker** tab on the approval page. It works the same way as the public page and also runs in the browser. Use it to check a press release, a contributor's submission or your own draft before publishing.

In **✍ Write story**, the **🤖 Check this text for AI** button (under the story text) opens the checker in a new tab, with the intro and story text already filled in. The story itself is not saved or changed. Copy any edits you want back into the story.

### Edit like a senior news editor (admin panel only)

On `/admin/ai-check`, **📰 Edit like a senior news editor** rewrites the pasted report to international wire-service standard, in the house style of agencies such as Reuters, AFP, AP and PTI:

- the most important new fact first (inverted pyramid), with a one-sentence lead that says who, what, where and when;
- every claim attributed with "said"; allegations kept as allegations;
- plain, neutral Indian English, with no clichés, hype or stock AI phrasing;
- a sentence-case headline of 8 to 14 words.

The editor also runs the **desk checks** a senior editor makes on every story. Problems go into the editor's notes:

- **consistency:** do names, numbers and descriptions agree throughout?
- **sourcing:** whose account is this: police, the complainant, an FIR?
- **fairness:** was the other side asked for a response?
- **clarity** and **legal risk**.

It keeps the dateline ("AGARTALA, Nov 4:") and tightens wordy sentences. Clean copy is changed only where it can be improved, so a well-written report may come back with few changes and useful notes.

The editor's version goes into the right-hand box with the headline on top. Under the two boxes, **What changed** shows every word removed (struck through, red) and added (green). The page also shows the **editor's notes**: questions for the reporter, such as a missing source, date or the other side's response. It lists what the editor changed and the AI-check score before and after.

The editor's rules come from a study of Reuters, AP, PTI, IANS, UNI, the BBC, The Economist and the Press Council of India's norms: see [9-NEWS-WRITING-STANDARDS.md](9-NEWS-WRITING-STANDARDS.md).

**It must not add facts.** The instructions forbid new names, figures, quotes, dates or claims; anything missing becomes a note. As a safety net, any figure in the edit that is not in the original is listed at the top of the notes. Always compare the edit with your source before publishing.

This button is the only part of the checker that leaves the device: the text is sent to the website's AI, which costs a little per edit. It uses Claude when the site has `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY`, and otherwise Gemini (`GEMINI_API_KEY`). Each person can use it 30 times an hour. To use a stronger Claude model for editing than for the daily summaries, set `CLAUDE_EDITOR_MODEL` (for example `claude-sonnet-5-5`); for Gemini, `GEMINI_EDITOR_MODEL`.

The public `/ai-tools/` page does not have this button, so visitors cannot spend the site's AI budget.

## Read this first

- **A score is not proof.** The built-in model is right on about 9 in 10 test texts, but it wrongly flags about 1 in 13 human texts. Formal academic prose and writing by non-native English speakers are flagged in error more often (Liang et al., 2023, "GPT detectors are biased against non-native English writers", *Patterns*). Never use a score alone as evidence against a person.
- **It is weaker on AI models and genres it has not seen.** On an unfamiliar genre it can wrongly flag most human texts. See "How well it works" below. Newer models (GPT-4 and later, recent Claude, Gemini, Llama 3) are not in the training data.
- **English only.** Bengali and Kokborok text is tokenised but not scored meaningfully.
- **The style editor does not hide AI use.** It improves clarity. If AI helped write a text, disclose that as your university or publisher requires.

## The built-in model

The model is logistic regression on two kinds of input:

- **14 style measures:** sentence length and its variation, vocabulary variety, punctuation, contractions, first-person words, transition words, stock AI phrases and repeated sentence openings.
- **25,000 words and two-word phrases**, each with a learned weight.

It was trained on **33,824 texts** (half human, half AI) from two public research datasets:

| Dataset | Domains | AI models | Licence |
|---|---|---|---|
| **M4** — Wang et al., 2024, "M4: Multi-generator, Multi-domain, and Multi-lingual Black-Box Machine-Generated Text Detection", *EACL 2024* ([GitHub](https://github.com/mbzuai-nlp/M4)) | arXiv abstracts, peer reviews (PeerRead), Reddit, Wikipedia, WikiHow | ChatGPT, GPT-3 davinci, Cohere, Dolly, BLOOMZ, FLAN-T5, LLaMA | No licence stated; cite the paper |
| **Ghostbuster** — Verma et al., 2024, "Ghostbuster: Detecting Text Ghostwritten by Large Language Models", *NAACL 2024* ([GitHub](https://github.com/vivek3141/ghostbuster-data)) | Student essays, creative writing, Reuters news | GPT-3.5, Claude | CC BY 3.0 |

Cite both papers if you use these results.

**How the corpus was cleaned** (`scripts/ai-text-corpus.js`). Without these steps a model learns formatting instead of writing style:

- Texts that still contained the generation prompt were dropped from both classes. These include "Use approximately 200 tokens", "Title:", "Question:", "Write a…" and "wikihow article". There were about 300 per domain before cleaning.
- Wikipedia human texts were cut to the lead section. The full articles had "References" and "External links" sections that the AI abstracts lacked.
- GPT-2 byte codes (Ġ, Ċ) in the Ghostbuster files were decoded.
- Spacing was normalised, because human arXiv abstracts had hard line breaks and the AI ones did not. Texts were capped at 400 words and needed at least 50.
- Human and AI texts were balanced within each domain, and duplicates were removed.
- Train, dev and test sets were split by **prompt group**. A human text and the AI texts written from the same prompt are always in the same split.

## How well it works

All figures are on texts the model never saw in training. "FPR" is the share of human texts wrongly flagged as AI.

**Overall (5,165 test texts)**

| Model | Accuracy | AUC | FPR |
|---|---|---|---|
| Previous built-in model (hand-set weights) | 59.1% | 0.643 | 28.0% |
| Style measures only, trained | 69.1% | 0.756 | 28.8% |
| **Style measures + words and phrases (built-in model)** | **90.9%** | **0.970** | **7.6%** |

**By domain (built-in model):** Reuters news 98.4%, creative writing 96.0%, peer reviews 94.8%, student essays 94.7%, Reddit 92.4%, WikiHow 91.1%, arXiv abstracts 84.1%, Wikipedia 79.1%.

**By AI model, share caught:** GPT-3.5 98.9%, ChatGPT 98.1%, FLAN-T5 97.6%, Claude 94.3%, Cohere 85.6%, GPT-3 davinci 84.9%, Dolly 68.9%, BLOOMZ 67.6%. Human texts correctly passed: 91.6%.

**AI models it has never seen.** Each AI model was left out of training in turn. The table shows how many of its texts were then caught:

| Left-out model | Caught | AUC |
|---|---|---|
| ChatGPT | 95.1% | 0.984 |
| GPT-3 davinci | 69.2% | 0.909 |
| Cohere | 66.5% | 0.914 |
| Claude | 46.3% | 0.825 |
| Dolly | 38.9% | 0.827 |

**Genres it has never seen.** Each domain was left out of training in turn and then tested:

| Left-out domain | Accuracy | AUC | Human texts wrongly flagged (FPR) |
|---|---|---|---|
| Peer reviews | 89.6% | 0.962 | 0.0% |
| arXiv abstracts | 76.5% | 0.847 | 21.9% |
| Wikipedia | 58.3% | 0.656 | 53.2% |
| Student essays | 55.4% | 0.660 | **82.2%** |

**Warning:** when student essays were left out of training, the model flagged **82% of real student essays as AI-written**. On an unfamiliar genre a detector can fail badly, and it fails in the direction that harms writers. The built-in model does include student essays, so this figure does not describe it. It shows why a detector must never be trusted on a genre it was not trained on.

**What this means.** The model works well on the kinds of text and the AI models it was trained on. It works much less well on AI models it has not seen, and it misses more than half of their texts. This matches the M4 paper's finding that detectors generalise poorly across generators and domains. For thesis work, train on text from the AI models and the genre you are studying (below), and report results for unseen models separately.

To reproduce these figures:

```bash
node scripts/ai-text-corpus.js --m4 <M4 clone> --ghostbuster <ghostbuster-data clone> --per-file 1100 --per-source 2000 --out corpus.csv
```

```bash
npm run ai-text-train -- corpus.csv --out public/ai-tools/model.js --name "M4 + Ghostbuster"
```

```bash
node scripts/ai-text-experiments.js corpus.csv --out experiments.json
```

## Teach it Gemini's writing

The built-in model has never seen Google Gemini text, and AI models it has not seen are its weak spot. In tests, it caught only 39–69% of texts from a left-out model. Adding Gemini texts to the training data fixes that for Gemini. `scripts/ai-text-gemini.js` pairs each chosen human text with a Gemini text of the same genre, length and topic, and gives both the same train/test group, so the test stays fair.

**Your Gemini subscription and the API.** A Google AI Pro (Gemini app) subscription covers the Gemini app and the AI Studio website. It does not include a Gemini API key or API usage. A separate API key from **aistudio.google.com → Get API key** is free and has a daily free quota for some models; check the current limits in AI Studio. Before you publish results, check Google's Gemini API terms on using its output.

**A) Automatic, with an API key (recommended: hundreds of texts).**

1. Create a free key at aistudio.google.com. Use a separate key from the website's `GEMINI_API_KEY`, so research runs do not use up the website's free summaries.
2. Make the key available as `GEMINI_API_KEY`. On your PC, put `GEMINI_API_KEY=your-key` in a `.env` file in the project folder. Never commit that file. In a Claude Code cloud session, add it as an environment variable in the environment settings, and start a new session. Never paste the key into a chat.
3. Build the corpus (see "How the corpus was cleaned"), then run:

   ```bash
   node --env-file=.env scripts/ai-text-gemini.js corpus.csv --out gemini.csv --per-domain 150
   ```

   This asks for 1,200 texts, 150 in each of the 8 genres. It uses `gemini-flash-latest` unless you add `--model`. Free-tier keys allow only a limited number of requests a day. When the limit is reached the script stops and says so; run the same command the next day and it continues where it stopped.
4. Retrain on both files and test:

   ```bash
   npm run ai-text-train -- corpus.csv gemini.csv --out public/ai-tools/model.js --name "M4 + Ghostbuster + Gemini"
   ```

   ```bash
   node scripts/ai-text-experiments.js corpus.csv gemini.csv --out experiments.json
   ```

   The experiment report now includes "Unseen generator: gemini": how much Gemini text the detector catches without having seen Gemini. That figure is worth reporting on its own.

**First results (November 2026, 77 texts written in the Gemini app).** Each Gemini text was matched to a human text of the same genre and topic. 79 of the 80 prompts were answered, and 2 answers were dropped as too short (under 50 words). Full figures are in `docs/ai-text-gemini-eval.json`; reproduce them with `node scripts/ai-text-new-model-eval.js corpus.csv gemini.csv`.

| Gemini texts caught | Zero-shot (built-in model, never saw Gemini) | After adding Gemini texts to training (5-fold) |
|---|---|---|
| **All genres** | **34 / 77 (44%)**, AUC 0.81 | **45 / 77 (58%)** |
| Student essays | 9 / 10 | 10 / 10 |
| News | 8 / 10 | 8 / 10 |
| Short stories | 8 / 10 | 8 / 10 |
| WikiHow | 7 / 10 | 7 / 10 |
| Peer reviews | 1 / 10 | 5 / 10 |
| arXiv abstracts | 0 / 10 | 5 / 10 |
| Wikipedia | 1 / 8 | 2 / 8 |
| Reddit ELI5 | 0 / 9 | 0 / 9 |

Human texts wrongly flagged stayed at 7.6–8.0% in all five folds. With only about 10 texts per genre, each genre figure is a rough estimate: one text is 10 percentage points. Training a full model on the corpus plus the 77 texts gave 90.5% test accuracy and an 8.2% false-positive rate, compared with 90.9% and 7.6% for the built-in model. So the built-in model was kept unchanged until more Gemini texts are available, through route A.

What this shows: Gemini's academic and explanatory writing (abstracts, peer reviews, ELI5 answers) usually passes as human to a detector trained on older AI models. A few dozen examples help in some genres but are not enough.

**B) By hand, in the Gemini app (about 50–100 texts).**

1. Export a prompt sheet: `node scripts/ai-text-gemini.js corpus.csv --prompts-out gemini-prompts.csv --per-domain 10` (80 prompts).
2. Open it in Google Sheets or Excel. Paste each prompt into a new Gemini chat and paste the reply into the **answer** column of the same row. Rows you leave empty are skipped.
3. Save it as CSV (Excel's plain "CSV" and "CSV UTF-8" both work) and import it: `node scripts/ai-text-gemini.js corpus.csv --import gemini-prompts.csv --out gemini.csv`. Use the same `corpus.csv` and `--per-domain` as in step 1, so the answers match their prompts.

A hand-made set is too small to train on well, but it makes a good **test** of how much Gemini text the current model catches. Use a new chat for each prompt, so earlier answers do not shape later ones.



Use the single-file version, `ai-text-checker.html`. Save it anywhere (for example, Documents) and double-click it to open it in Chrome, Edge or Firefox. It contains the whole tool and the built-in model, so it needs no Python, Node or web server.

To rebuild that file after changing `engine.js`, `model.js` or `index.html`, run:

```bash
node scripts/ai-text-standalone.js ai-text-checker.html
```

## Train a model on your own data (for research)

Training needs Node.js (free, from nodejs.org).

1. Make a CSV file with a header row `label,text`. Use one row per text. The label must be `ai` or `human` (or `1`/`0`). Put each text in double quotes. Texts of 150 words or more give steadier results.

   ```
   label,text
   human,"The first paragraph of a thesis chapter written in 2015…"
   ai,"A passage generated by a language model from the same prompt…"
   ```

   For a fair test, the two groups should cover the same topics and genres, and be roughly balanced. Otherwise the model learns topic differences instead of authorship.

2. **Small corpus (up to a few hundred texts):** run

   ```bash
   npm run ai-text-train -- my-corpus.csv --out my-model.json --name "Thesis corpus v1"
   ```

   This trains the style measures only and reports **5-fold cross-validated accuracy and AUC**.

   **Larger corpus (a few thousand texts or more):** add a `split` column with `train`, `dev` or `test` on each row. Keep texts from the same prompt or source in the same split. The same command then also learns word and phrase weights, tunes itself on `dev`, and reports accuracy, AUC, F1 and the false-positive rate on `test`. Optional `domain` and `generator` columns give a breakdown by group.

   You can also merge your texts into the M4 + Ghostbuster corpus, so the model learns your genre and keeps the general data.

3. On the `/ai-tools/` page, click **Use another model (.json)** and choose `my-model.json`. The page now scores with your model and shows its test accuracy.

AUC is the usual figure to report: 0.5 means chance and 1.0 means perfect separation. Report the false-positive rate as well, because it is the error that harms people.

## Files

| File | What it is |
|---|---|
| `public/ai-tools/engine.js` | Features, scoring, sentence scoring and style editor (no dependencies) |
| `public/ai-tools/model.js` | The built-in trained model (generated; do not edit by hand) |
| `public/ai-tools/index.html` | The web page |
| `scripts/ai-text-corpus.js` | Builds the cleaned corpus from M4 and Ghostbuster |
| `scripts/ai-text-train.js` | Training and evaluation |
| `scripts/ai-text-experiments.js` | Baselines and unseen-model / unseen-domain tests |
| `scripts/ai-text-gemini.js` | Adds Gemini texts to the corpus (API or by hand) |
| `lib/news-editor.js` | The "senior news editor" instructions and rewrite (admin panel) |
| `scripts/ai-text-new-model-eval.js` | How well the detector catches a new AI model (zero-shot and 5-fold) |
| `scripts/ai-text-standalone.js` | Builds the single-file version for use on a PC |
| `tests/ai-text.test.js` | Tests (`npm test`) |

To change what the style editor fixes automatically, edit `SAFE_REPLACEMENTS` in `engine.js`. Only add a replacement if it can never change the meaning or the grammar. To change the suggested alternatives, edit `PHRASE_ADVICE`. Do not edit `AI_PHRASES` without retraining, because it is one of the model's measured features.
