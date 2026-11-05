# 10. PhD thesis checker: AI-text check, suggestions and academic editor

A private tool for the owner's PhD thesis in journalism and mass communication. It has three parts:

1. **Checker:** finds your own prose in a chapter and estimates, paragraph by paragraph, how much it reads like AI-generated academic writing. It shows the words and patterns behind each score.
2. **Suggestions:** marks the words that became common in research writing after ChatGPT, stock AI formulas, claims about the literature that have no citation, and overclaiming. Each comes with plain alternatives you can apply in one click.
3. **Academic editor:** an AI rewrite of one paragraph at a time, in the manner of the website's senior news editor. It keeps your citations, quotations, figures and terms, never adds a fact or a source, and lists anything missing as a note for you. A "What changed" view shows every word removed and added.

**Where it is**

- **Admin panel → 🎓 Thesis checker** (`/admin/thesis-check`). Only the admin account can open it; editors and sub-editors cannot. It is not linked from the public website.
- **Offline file for your PC** (`thesis-checker.html`). It has the checker and the suggestions, but no academic editor, because the editor needs the website's AI key. Build it with `node scripts/thesis-standalone.js thesis-checker.html`, save it anywhere and double-click it. It works without the internet.

**Privacy.** The checking runs in your browser: the chapter is not sent to the website or to any AI service. Only **Edit with the academic editor** sends that one paragraph to the website's AI (Claude, or Gemini if no Claude key is set) to make the edit. The website does not store it. Your changes are kept only in the open tab until you download the revised text.

## Read this first

- **A score is not proof.** On 6,643 test abstracts it had never seen, the model was right 93.8% of the time. It wrongly flagged 4.8% of human abstracts at the 50/100 mark and 2.1% at its "AI-like" level (68/100). Formal academic prose and writing by people whose first language is not English are flagged in error more often (Liang et al., 2023). Published tests of commercial detectors, Turnitin included, reach the same conclusion: no detector is reliable enough to be the only evidence (Weber-Wulff et al., 2023).
- **It was trained on abstracts, not thesis chapters.** No public collection of thesis chapters with AI versions was reachable from this environment. Literature reviews are flagged more often than abstracts by detectors in general (Dalalah and Dalalah, 2023), so treat paragraph scores in a literature review with extra caution.
- **It was trained on older AI models.** Most AI texts in the training data come from ChatGPT (GPT-3.5, 2023). AI models it never saw are caught much less often (see "How well it works"). Current models are not in the data.
- **Light AI polishing of your own text is mostly not detected, and an AI "humaniser" defeats it.** Both results are in the tables below. That is why the tool is for improving your writing, not for proving anything about anyone.
- **The suggestions do not hide AI use.** They make your prose plainer and more specific. If AI helped you write, disclose it as your university requires. In India the UGC (Promotion of Academic Integrity and Prevention of Plagiarism in Higher Educational Institutions) Regulations, 2018 apply. I found no binding UGC regulation specific to AI in PhD theses (searched November 2026), so your university's own policy is the one to follow.

## How to use it

1. Open the chapter as a Word **.docx** file, or paste it. For a PDF, save it as .docx in Word first. The old .doc format cannot be read.
2. The checker sorts the paragraphs. Headings, quotations, interview extracts ("Respondent 4: …"), table cells, captions ("Table 2.1 …") and everything after the **References** or **Bibliography** heading are left out. In your own paragraphs, quotations and citations are also removed before scoring, so only your words are scored.
3. Read the **Overview** (the share of your words in AI-like, mixed and human-like paragraphs), the **Sections** list and **Your voice in numbers**.
4. Under **Paragraphs**, the default view shows only paragraphs that need attention. Hover over a mark to see why it was flagged. Apply an alternative with one click, or press **Edit with the academic editor**. Choose **Light** (words only) or **Thorough** (sentence structure too).
5. Check the editor's version against your sources. Read its notes, then press **Use the edited version**, edit it further in the box, or discard it.
6. **Download revised text (.txt)** and copy the paragraphs you want into your Word file.

A paragraph needs at least 60 of your own words to get its own score. Shorter ones are scored with their section. A section needs 150 words.

## What the marks mean

| Mark | What it means | Based on |
|---|---|---|
| Word that rose with ChatGPT | One of 215 style words that appeared at least twice as often in research abstracts in 2024 as in 2022. Each flag shows the word's ratio, for example "delves" 47.8 times, "showcasing" 13.8, "underscores" 13.8, "intricate" 7.4, "pivotal" 3.1. | Kobak et al. (2025), *Science Advances*: 15 million PubMed abstracts. Their published word list and yearly counts (MIT licence); only words they marked "style", not "content". |
| Stock formula | Phrases such as "plays a crucial role", "a nuanced understanding of", "provides valuable insights", "the intricate interplay between", "navigating the complexities", "In today's digital age, …", a trailing ", highlighting…" clause, "not only … but also", "In conclusion," mid-chapter. | The senior news editor's rules and the corpus studies below |
| Needs a citation | "Many scholars argue…", "Studies have shown…", "It is widely accepted…" with no citation in the same sentence | Standard academic practice |
| Overclaim | "proves", "undoubtedly", "it is clear that" | Hedging and boosters in academic writing (Hyland, 2005) |
| Wordy | "in order to" → "to", "prior to" → "before", and others: the checker's fixed replacements | `SAFE_REPLACEMENTS` in `engine.js` |
| AI-like sentence (underlined) | A sentence whose words and phrases the academic model weighs as AI-like | The trained model |
| Long sentence / even rhythm | Over 45 words; or every sentence in the paragraph about the same length | Sentence-length variation is lower in AI text (corpus figures below) |

Matches inside quotation marks and citations are never flagged or changed.

**Word lists age.** After "delve" was widely reported as an AI word, its use fell, while other ChatGPT favourites kept rising (Geng et al., 2025). Kousha et al. (2025) also found much smaller rises in the social sciences than in STEM fields. A rising word is a reason to check your choice, not a sign of AI use.

## Your voice in numbers

The table compares your text, per 1,000 of your own words, with the averages for human and ChatGPT abstracts in the humanities and social sciences. It uses 1,330 of each from the test split of the corpus, computed by `scripts/thesis-norms.js`. A figure turns red when yours is nearer the AI average than the human one.

| Per 1,000 words | Human abstracts | ChatGPT abstracts |
|---|---|---|
| Self-mention (I, we, the researcher) | 10.0 | 6.2 |
| Frame markers (this study, firstly, in conclusion) | 4.7 | 9.9 |
| Words that rose with ChatGPT | 3.5 | 12.9 |
| Transitions (moreover, however, therefore) | 3.0 | 4.2 |
| Hedges (may, suggests, appears) | 6.3 | 7.8 |
| Boosters (clearly, proves) | 0.9 | 0.6 |
| Citations | 0.6 | 0.0 |
| Variation in sentence length (higher = more varied) | 0.38 | 0.25 |
| Average sentence length (words) | 24.8 | 24.9 |

The first three rows agree with published corpus studies. AI academic text uses fewer self-mentions and more frame markers and structuring devices than human writers (Jiang and Hyland, 2024; Mo et al., 2025; Pham, 2026). In this corpus, however, ChatGPT used slightly *more* hedges than human authors, while several studies report fewer. So the tool does not treat hedging as a sign of AI. Abstracts are denser than chapters, so read the table as a direction, not a target.

## The academic editor

The rules are in `ACADEMIC_SYSTEM` in `lib/academic-editor.js`:

- **Never add anything.** No new fact, finding, figure, date, name, newspaper, quotation, source, theory or citation. A reference is never invented or completed. Anything missing becomes a note.
- **Keep exactly:** every citation (character for character and in place), every quotation (interview answers, survey answers, newspaper text), every number, and every technical term (agenda-setting, framing, gatekeeping, public sphere, purposive sampling…).
- **Keep your position.** A claim is never made stronger or weaker, so "suggests" stays "suggests". An overclaim is kept and mentioned in the notes. Your "I", "we" or "the researcher" stays as written, and so does your spelling (Indian/British "-ise" unless you use American spelling throughout). Established Indian usage (lakh, crore) is not "corrected".
- **Edit:** plain words, the active voice where the actor matters, no stock AI vocabulary or formulas, no trailing ", highlighting…" clauses, no added signposting or summaries, varied sentence length, past and present tense used conventionally.
- **Notes for you:** claims about the literature with no citation, claims needing evidence, overstatements, inconsistent terms, generic sentences that need your own data, and research-ethics points (identifiable respondents, minors, confidential sources, caste details).

**Safety nets.** After every edit, the tool checks, without AI, that:
- every citation in your paragraph is still in the edit, and no new one appeared;
- every quotation is unchanged, word for word;
- no figure appears that was not in your text;
- the number of paragraphs is the same.

Any difference goes to the top of the notes. The checker's fixed replacements ("in order to" → "to") are then made outside quotations and citations. Words that rose sharply with ChatGPT and are still in the edit are listed.

**Not used here:** the website's news house style (`WRITING_RULES`: "said", datelines and so on), because it is for news copy, and the Teach the AI lessons, which are news-desk phrases.

**Model and cost.** The editor uses `CLAUDE_ACADEMIC_MODEL` if set, then `CLAUDE_EDITOR_MODEL`, then the site's default Claude model. With Gemini, it uses `GEMINI_ACADEMIC_MODEL`, then `GEMINI_EDITOR_MODEL`. For thesis work a stronger model is worth it: set `CLAUDE_ACADEMIC_MODEL` (for example `claude-opus-5-5` or `claude-sonnet-5-5`) in Vercel's environment variables. Each edit of one paragraph is one AI request. The admin can make 60 an hour.

## The training data

All datasets are public research datasets that could be cloned from GitHub in this environment. Hugging Face, arXiv, OpenAlex and Shodhganga were blocked by the network settings.

| Dataset | What it gave | Licence / citation |
|---|---|---|
| **GPABench2**: Liu, Yao, Li and Luo (2024), "On the Detectability of ChatGPT Content: Benchmarking, Methodology, and Evaluation through the Lens of Academic Writing", *ACM CCS 2024* ([GitHub](https://github.com/liuzey/CheckGPT)) | 8,993 humanities and social-science abstracts, and 2,500 each in computer science and physics. Each is paired with a ChatGPT version written from the title (50%), completed from the first half (20%) or polished (30%). | Cite the paper |
| **CHEAT**: Yu et al., "CHEAT: A Large-scale Dataset for Detecting ChatGPT-writtEn AbsTracts", *IEEE Transactions on Big Data* ([GitHub](https://github.com/botianzhe/CHEAT)) | 2,997 IEEE abstracts with ChatGPT generation, polish and fusion versions | MIT |
| **M4**: Wang et al. (2024), *EACL 2024* ([GitHub](https://github.com/mbzuai-nlp/M4)) | arXiv abstracts and PeerRead peer reviews from ChatGPT, GPT-3 davinci, Cohere, Dolly, BLOOMZ, FLAN-T5 and LLaMA | Cite the paper |
| **DetectRL**: Wu et al. (2024), *NeurIPS 2024 Datasets and Benchmarks* ([GitHub](https://github.com/NLP2CT/DetectRL)) | 2,800 arXiv abstracts by ChatGPT, Google PaLM, Claude-instant and Llama-2-70b, AI-polished versions, and DIPPER paraphrases (hard test only) | Cite the paper |
| **MixSet**: Zhang et al. (2024), "LLM-as-a-Coauthor", *Findings of NAACL 2024* ([GitHub](https://github.com/Dongping-Chen/MixSet)) | Human text revised by AI, and AI text "humanised" by GPT-4 and Llama 2 (hard test only, never trained on) | Cite the paper |
| **Excess vocabulary**: Kobak et al. (2025), *Science Advances* 11(27), eadt3813 ([GitHub](https://github.com/berenslab/llm-excess-vocab)) | The 215 rising style words and their 2024/2022 ratios | MIT |

**Corpus:** 44,514 texts, half human and half AI: 33,431 for training, 4,440 for tuning and 6,643 for testing. Built by `scripts/thesis-corpus.js`. The cleaning matters as much as the model, because without it a model learns formatting instead of writing:

- **Length matched.** The human abstracts in GPABench2 average 334 words and ChatGPT's 167. Each human text is cut at a sentence end to about the length of its AI partner, so the model cannot learn length.
- **Pairs kept together.** Each human abstract and the AI texts made from it share a group, and the split is made by group. An abstract that appears in two datasets gets the same group, so no abstract is on both the training and the test side.
- **Artefacts removed.** The first training run showed what a model learns from unclean data. It took "ofthe", "inthe" (spaces lost at line breaks in the human arXiv files), "emph" (LaTeX) and "(abridged)" as signs of human writing, and "Here is the abstract…" (the chatbot's preamble) as a sign of AI. All of these are now removed or repaired: run-together words are split again only where one half is a short function word, LaTeX and publisher notices are stripped, and preambles are cut. After cleaning, accuracy fell from 94.3% to 93.8%, which shows the model had been leaning a little on those artefacts.
- **Balanced** within each discipline, with duplicates removed.

**Model:** logistic regression on 14 style measures and 15,000 words and two-word phrases. The settings were chosen on the tuning split. This is the same method as the website's news checker, so it runs in the browser in a fraction of a second.

- **Strongest AI cues:** "additionally", "overall this", "paper examines", "the researchers", "paper explores", "our research", "insights into", "our findings", "involves".
- **Strongest human cues:** "hence", "etc", "analysed", "because of", "together with", "accordingly", "thus", "i e".

The British spelling "analysed" is a human cue because ChatGPT writes "analyzed". That helps an Indian writer, but it also means AI text with British spelling is harder to catch.

The "AI-like" level (68/100) is set on the tuning split so that no more than 2% of human abstracts reach it.

## How well it works

All figures are on texts the model never saw. "Flagged" (FPR) is the share of human texts wrongly marked as AI. Full figures are in `docs/thesis-ai-eval.json`.

**Overall (6,643 test abstracts)**

| Model | Accuracy | AUC | Human texts flagged | AI texts caught |
|---|---|---|---|---|
| The website's news model (M4 + Ghostbuster) | 79.0% | 0.928 | **35.4%** | 93.5% |
| **Academic model, at 50/100** | **93.8%** | **0.985** | **4.8%** | **92.3%** |
| Academic model, at the "AI-like" level (68/100) | 93.3% | | 2.1% | 88.8% |

On humanities and social-science abstracts alone, the news model flagged **50.8%** of the human texts as AI. A detector built for one kind of writing must not be used on another, which is why the thesis tool has its own model.

**By discipline (academic model):**

| Discipline | Accuracy | AUC | Human texts flagged |
|---|---|---|---|
| Humanities and social sciences (GPABench2) | 95.8% | 0.993 | 4.0% |
| Physics (GPABench2) | 96.6% | 0.995 | 4.1% |
| Computer science (GPABench2) | 95.7% | 0.992 | 5.2% |
| Peer reviews (PeerRead) | 93.8% | 0.994 | 2.2% |
| IEEE abstracts (CHEAT) | 91.8% | 0.976 | 7.0% |
| arXiv abstracts (M4, DetectRL) | 88.6% | 0.957 | 5.5% |

**By kind of AI use:**

| Kind | Share labelled correctly |
|---|---|
| Written by ChatGPT from the title | 95.7% |
| Second half completed by ChatGPT | 94.4% |
| Whole abstract polished by ChatGPT | 84.6% |
| Human texts | 95.2% |

**A discipline it has never seen.** Each discipline was left out of training in turn:

| Left out | Accuracy | AUC | Human texts flagged | AI caught |
|---|---|---|---|---|
| Humanities and social sciences | 90.4% | 0.973 | 14.6% | 95.4% |
| IEEE abstracts | 88.9% | 0.963 | 10.6% | 88.5% |
| arXiv abstracts | 74.4% | 0.914 | 0.7% | 49.9% |

Without social-science training texts, the model flags about **1 in 7** real social-science abstracts. Journalism and mass communication writing is a kind it has seen only as part of the general social-science data, so training on your own field (next steps) matters.

**AI models it has never seen.** Each was left out of training in turn:

| Left out | AI texts caught | AUC |
|---|---|---|
| Llama-2-70b | 97.1% | 0.996 |
| Claude-instant | 67.4% | 0.948 |
| Google PaLM | 57.9% | 0.882 |
| Cohere | 50.6% | 0.870 |
| Dolly | 21.9% | 0.714 |

**Hard tests.**

| Test | Result |
|---|---|
| AI text paraphrased by DIPPER (a paraphrasing model) | 91.8% still caught (85.7% at the "AI-like" level) |
| AI polishing of human text, when no polished text was in training | 44.4% caught |
| MixSet: human text polished, rewritten or completed by GPT-4 or Llama 2 (mostly non-academic genres) | 21–31% flagged |
| MixSet: **AI text "humanised" by GPT-4 or Llama 2** | **97.8% passed as human** |

What this means:
- The model separates human and ChatGPT academic writing well.
- Light AI editing of a human text mostly reads as human. That is reasonable, because the ideas and most of the words are still the writer's.
- An AI rewrite aimed at sounding human defeats it, as it defeats commercial detectors (Weber-Wulff et al., 2023; Perkins et al., 2023).

## Test on real theses: before and after ChatGPT (November 2026)

`scripts/thesis-era-test.js` runs both checkers and the style measures on a folder of real theses and papers listed in a manifest (`path,year,group`). It reads PDF, Word and text files. The owner supplied about 110 documents from their literature folder: Shodhganga thesis chapters and journal papers on environmental and climate news coverage. They are not stored in the repository. Results:

| Group | Paragraphs | Academic checker flags | News checker flags | ChatGPT-era words per 1,000 | Commas per 100 words | Sentence variation |
|---|---|---|---|---|---|---|
| Indian PhD theses before ChatGPT (23 chapters) | 802 | 1.4% | 16% | 1.4 | 5.4 | 0.40 |
| Papers and reports before ChatGPT (45) | 2,352 | 1.1% | 19% | 2.0 | 6.8 | 0.48 |
| *Global Environmental Change* vol. 70, 2021 (18 papers) | 471 | 0.4% | 19% | 2.3 | 7.9 | 0.54 |
| Papers and theses 2023–2026 (25) | 1,159 | 9.4% | 32% | 5.7 | 6.9 | 0.46 |
| Known AI: two drafts written by an AI assistant | 16 | 0% | 12% | 1.4 | 5.3 | 0.43 |
| Known AI: 12 paragraphs by a current AI model | 12 | 0% | 33% | 3.4 | 4.6 | 0.28 |

What this shows:
- False alarms on genuine pre-ChatGPT writing in the owner's field are rare: 38 of 3,625 paragraphs (1.0%), some of them table fragments left by the PDF conversion.
- After 2022, ChatGPT-style writing becomes common: flags and ChatGPT-era words both rise sharply.
- The checker does **not** detect text from current AI assistants, which avoid the 2023 ChatGPT vocabulary. Commas, mistakes and sentence length do not separate these texts either.

The next step is to train on current-AI text in the owner's genre, matched to these human paragraphs, and to test on the two AI drafts, which the model has not seen.

## Next steps (the owner chose to proceed with what was available; these need settings or money)

1. **Unblock the research sites** in this environment's network settings: huggingface.co, arxiv.org, export.arxiv.org, api.openalex.org, shodhganga.inflibnet.ac.in. Then (a) add pre-2022 journalism and mass communication abstracts from OpenAlex as human text, (b) add chapters of Indian PhD theses in mass communication from Shodhganga, from before 2022, as human text in the genre that matters, and (c) add larger detector benchmarks (RAID, MAGE, HC3). A changed network setting usually applies only to a new session.
2. **AI texts from current models in your field.** With an API key (Anthropic, OpenAI or Google) as an environment variable, generate about 2,000–3,000 journalism and mass communication passages: literature reviews, method sections and discussions, matched to the human texts by topic and length. My estimate is US$10–40 (to be checked against current prices before spending). That is the most direct way to raise the 50–70% caught on unseen models.
3. **Calibrate on your own writing.** A dozen chapters or papers you wrote before ChatGPT (2022) would show how often your own style is flagged, and the "AI-like" level could be set for you.
4. **A stronger model.** A fine-tuned transformer (DistilBERT/RoBERTa) reaches higher accuracy in the literature but needs a server or a 60–250 MB download. The present model was kept because it is fast, explainable and private.

## Files

| File | What it is |
|---|---|
| `app/admin/thesis-check/` | The admin page (`page.js`), the interface (`ThesisCheck.js`) and the editor call (`actions.js`) |
| `public/ai-tools/academic.js` | .docx reading, paragraph sorting, quotations and citations, suggestions, voice profile, whole-document analysis |
| `public/ai-tools/model-academic.js` | The academic model (generated; do not edit) |
| `public/ai-tools/academic-words.js`, `academic-norms.js` | The rising words and the voice norms (generated) |
| `lib/academic-editor.js` | The academic editor's instructions, the AI call and the safety nets |
| `scripts/thesis-corpus.js` | Builds the corpus from the datasets above |
| `scripts/thesis-train.js` | Trains the model and writes `docs/thesis-ai-eval.json` |
| `scripts/thesis-words.js`, `scripts/thesis-norms.js` | Build the word list and the voice norms |
| `scripts/thesis-standalone.js`, `scripts/thesis-checker.template.html` | Build the offline single-file version |
| `tests/thesis.test.js` | Tests (`npm test`) |

To reproduce:

```bash
git clone --depth 1 https://github.com/liuzey/CheckGPT
git clone --depth 1 https://github.com/botianzhe/CHEAT
git clone --depth 1 https://github.com/mbzuai-nlp/M4
git clone --depth 1 https://github.com/NLP2CT/DetectRL
git clone --depth 1 https://github.com/Dongping-Chen/MixSet
git clone --depth 1 https://github.com/berenslab/llm-excess-vocab
node scripts/thesis-corpus.js --gpabench CheckGPT --cheat CHEAT --m4 M4 --detectrl DetectRL --mixset MixSet --out thesis-corpus.csv
node --max-old-space-size=12000 scripts/thesis-train.js thesis-corpus.csv --robust thesis-corpus-robust.csv
node scripts/thesis-norms.js thesis-corpus.csv
node scripts/thesis-words.js llm-excess-vocab
```

## References

- Dalalah, D. and Dalalah, O. M. A. (2023). The false positives and false negatives of generative AI detection tools in education and academic research: The case of ChatGPT. *The International Journal of Management Education*, 21(2), 100822.
- Geng, M. et al. (2025). Human-LLM coevolution: Evidence from academic writing. arXiv.
- Hyland, K. (2005). *Metadiscourse: Exploring Interaction in Writing*. Continuum.
- Jiang, F. and Hyland, K. (2024). Does ChatGPT argue like students? Bundles in argumentative essays. *Applied Linguistics*.
- Kobak, D., González-Márquez, R., Horvát, E.-Á. and Lause, J. (2025). Delving into LLM-assisted writing in biomedical publications through excess vocabulary. *Science Advances*, 11(27), eadt3813.
- Kousha, K. et al. (2025). How much are LLMs changing the language of academic papers after ChatGPT? A multi-database and full text analysis. arXiv.
- Liang, W., Yuksekgonul, M., Mao, Y., Wu, E. and Zou, J. (2023). GPT detectors are biased against non-native English writers. *Patterns*, 4(7).
- Liu, Z., Yao, Z., Li, F. and Luo, B. (2024). On the detectability of ChatGPT content: Benchmarking, methodology, and evaluation through the lens of academic writing. *ACM CCS 2024*.
- Mo, Z. et al. (2025). Exploring the affordances of generative AI large language models for stance and engagement in academic writing. *Journal of English for Academic Purposes*.
- Perkins, M. et al. (2023). Detection of GPT-4 generated text in higher education: Combining academic judgement and software to identify generative AI tool misuse. *Journal of Academic Ethics*.
- Pham, L. (2026). Metadiscourse in ChatGPT-generated and human-written research articles in linguistics. *Indonesian Journal of Applied Linguistics*.
- Wang, Y. et al. (2024). M4: Multi-generator, multi-domain, and multi-lingual black-box machine-generated text detection. *EACL 2024*.
- Weber-Wulff, D. et al. (2023). Testing of detection tools for AI-generated text. *International Journal for Educational Integrity*, 19, 26.
- Wu, J. et al. (2024). DetectRL: Benchmarking LLM-generated text detection in real-world scenarios. *NeurIPS 2024 Datasets and Benchmarks*.
- Yu, P. et al. CHEAT: A large-scale dataset for detecting ChatGPT-written abstracts. *IEEE Transactions on Big Data*.
- Zhang, Q. et al. (2024). LLM-as-a-Coauthor: Can mixed human-written and machine-generated text be detected? *Findings of NAACL 2024*.
