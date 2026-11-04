# 8. AI text checker and style editor

A research tool with two parts:

1. **Checker:** gives a 0–100 score for how likely a text is to be AI-generated. It shows the words, phrases and style measures behind the score.
2. **Style editor:** fixes wordy phrases automatically ("the majority of" → "most") and marks the sentences that read as AI-written. It also lists AI-typical words and patterns, with plainer options you can apply in one click.

All the work happens in the reader's browser. No text is sent to the website, to Claude or to any other service. The page is at **`/ai-tools/`** on the website (`https://www.insightnenews.in/ai-tools/`). It is hidden from search engines (`noindex`) and does not appear in the site menu.

## In the admin panel

Signed-in staff (admin, editors and sub-editors) also have the tool at **`/admin/ai-check`**: the **🤖 AI checker** tab on the approval page. It works the same way as the public page and also runs in the browser. Use it to check a press release, a contributor's submission or your own draft before publishing.

In **✍ Write story**, the **🤖 Check this text for AI** button (under the story text) opens the checker in a new tab, with the intro and story text already filled in. The story itself is not saved or changed. Copy any edits you want back into the story.

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

## Use it on your PC (no internet, nothing to install)

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
| `scripts/ai-text-standalone.js` | Builds the single-file version for use on a PC |
| `tests/ai-text.test.js` | Tests (`npm test`) |

To change what the style editor fixes automatically, edit `SAFE_REPLACEMENTS` in `engine.js`. Only add a replacement if it can never change the meaning or the grammar. To change the suggested alternatives, edit `PHRASE_ADVICE`. Do not edit `AI_PHRASES` without retraining, because it is one of the model's measured features.
