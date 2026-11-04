# 9. News writing standards: what the agencies and style guides say

This is the study behind the "senior news editor" in the admin AI checker (`lib/news-editor.js`). It summarises how international wire services and standard newsrooms write headlines, datelines, leads, bodies and endings. Each point names its source.

**How this was researched (November 2026).** The cloud session could not open news websites directly, because its network blocks them. The study therefore used web search, which returns findings from these organisations' public pages and archived copies of their style guides. Several style guides were available only as older editions: the Reuters Handbook (about 2008–2015), the BBC News Styleguide and the Guardian style guide (2002). Points marked *unconfirmed* could not be checked against the organisation's own current text. The rules are paraphrased, not copied.

## 1. Dateline

| Organisation | Form | Source |
|---|---|---|
| Reuters | `RABAT, Nov 4 (Reuters) -`: city in capitals, date and "(Reuters)" in mixed case, then a spaced dash before the first paragraph | Reuters Handbook of Journalism ([copy](https://www.mediareform.org.uk/wp-content/uploads/2015/12/Reuters_Handbook_of_Journalism.pdf)); a live Reuters story carried by [ThePrint](https://theprint.in/world/morocco-says-it-will-uphold-western-sahara-ceasefire-after-un-mission-ends/3090911/) |
| AP | City in capitals, usually followed by state or country; well-known cities stand alone | [Writing Explained](https://writingexplained.org/ap-style/ap-style-datelines), [GrammarBook](https://www.grammarbook.com/blog/dates-and-times/ap-style-datelines/) |
| PTI | `Agartala, Nov 4`: place, short date, agency | PTI story of 4 November 2026 on [ThePrint](https://theprint.in/india/two-youths-held-with-three-pistols-50-cartridges-in-tripura/3090893/) |
| IANS | `Agartala, October 15 (IANS)` | IANS stories listed by [Morung Express](https://mail.morungexpress.com/tag/tripura?page=6) |
| UNI | `Agartala, June 27 (UNI)` | [UNI](https://test.uniindia.com/five-bangladeshis-and-three-indian-touts-arrested-in-tripura/east/news/3501241.html) |
| AFP | *Unconfirmed:* no source in the search showed AFP's exact form | — |

Rules:
- The dateline says where the news was gathered. Reuters uses one only when its own staff or stringers are at that place (Reuters Handbook).
- Each publication keeps one house form. **InsightNE's form is `Agartala, Nov 4:`**: the place in normal capitals, as PTI, IANS and UNI write it, not `AGARTALA`. The editor keeps the reporter's place, date and punctuation, writes the place in normal capitals, and never adds a dateline. A place and date are facts.

## 2. Headline

- **Present tense for past events; "to" plus a verb for future events** ("Parliament to decide policy tomorrow"). Articles (a, an, the) and forms of "be" are usually dropped. Source: headline-writing guides, including [a university lecture handout](https://uomustansiriyah.edu.iq/media/lectures/8/8_2018_03_13!06_31_13_PM.pdf) and [Brighton English](https://englishlessonsbrighton.co.uk/8-grammar-rules-writing-newspaper-headlines/).
- **The headline comes from the intro and must make sense on its own**, because it is shown without the story. No sensationalism or clickbait. Source: an older BBC website writing guide ([copy](https://www.slideshare.net/slideshow/guide-for-journos-writing-for-bbc-website/10074152)).
- **Sentence case**: capital letter only for the first word and proper nouns. *Unconfirmed* for Reuters (secondary source: [Patriot University](https://patriot.university/knowledge-base/investigative-toolkit/ai-skills/patriot-headline-style/)). It is InsightNE's house style either way.
- "If you can write the headline, you can write the lead": the two should say the same news. Source: Reuters Handbook ([copy](https://mediakar.wordpress.com/wp-content/uploads/2012/10/handbook-of-journalism-reuters.pdf)).

## 3. Intro (lead)

- **The lead is the key:** get it right and the rest follows. Many readers read only the first paragraph. Source: Reuters Handbook.
- **Only the most telling detail, and no more than one time element.** A locator is often unnecessary in the lead. Source: Reuters Handbook.
- **Length:** one sentence, ideally 20–25 words ([Wikipedia, News style](https://en.wikipedia.org/wiki/News_style)) and no more than 35 ([UNT Writing Center](https://writingcenter.unt.edu/images/writinglab.unt.edu/files/ap_style_2.pdf)).
- **A strong active verb in the first sentence.** Do not open with a question, with "as expected", or with "It has been suggested that…": state the fact and then attribute it. Source: BBC News Styleguide ([copy](https://www.peteburns.com/downloads/BBC%20news%20styleguide.pdf)).
- The Five Ws (who, what, when, where, why) are the checklist ([Wikipedia, Five Ws](https://en.wikipedia.org/wiki/Five_Ws)). Leaving the main point out of the first paragraph is "burying the lead" ([Wikipedia, Lead paragraph](https://en.wikipedia.org/wiki/Lead_paragraph)).

## 3a. Headlines and intros for digital news (study of November 2026)

**Real headlines and leads from Indian agencies this week** (short quotations for study):

| Agency | Headline | Lead (as reported) | What a wire desk keeps / changes |
|---|---|---|---|
| ANI, 3 Nov | "3 BSF jawans injured in brutal attack by smugglers in Tripura's Boxanagar; tension grips Ashabari" | "Three Border Security Force (BSF) jawans were brutally assaulted by a group of alleged smugglers in the Ashabari area under Boxanagar in Tripura on Monday." | Keeps: number first, place in headline, abbreviation spelled out, "alleged". Changes: "brutal"/"brutally" (judgement word), passive lead, second clause after the semicolon. ([ANI](https://www.aninews.in/news/national/general-news/3-bsf-jawans-injured-in-brutal-attack-by-smugglers-in-tripura8217s-boxanagar-tension-grips-ashabari20261103022328/)) |
| ANI, 3 Nov | "8 arrested for assault on BSF personnel in Tripura's Ashabari; CM Manik Saha assures strict action" | — | Number first; a follow-up headline leads with the new development (arrests). ([ANI](https://aninews.in/news/national/general-news/8-arrested-for-assault-on-bsf-personnel-in-tripuras-ashabari-cm-manik-saha-assures-strict-action20261103101417/)) |
| PTI, 4 Nov | "Two youths held with three pistols, 50 cartridges in Tripura" | "…were arrested with three sophisticated pistols and 50 cartridges in Agartala on Wednesday, police said." | Short, factual, place in headline, attribution at the end of the lead. ([ThePrint/PTI](https://theprint.in/india/two-youths-held-with-three-pistols-50-cartridges-in-tripura/3090893/)) |

**Headline length and wording online**

- Google sets no maximum title length, but it cuts the title link to fit the device, usually about 600 pixels, or roughly 55–60 characters on desktop. It advises against long, wordy titles ([Google Search Central](https://developers.google.com/search/docs/appearance/title-link); [Zyppy](https://zyppy.com/title-tags/meta-title-tag-length/)). Google may rewrite titles, so put the important words first.
- Google News: headlines should be clear and accurate, and the page title should match the headline ([Google Publisher Center](https://support.google.com/news/publisher-center/answer/9607104?hl=en); [Search Engine Land](https://searchengineland.com/google-shares-tips-for-success-in-google-news-search-results-310702)).
- The BBC News website introduced **two headlines** per story: a short one of 31–33 characters for the front page and mobile, and a longer one of up to 55 characters for the story page and search ([journalism.co.uk](https://www.journalism.co.uk/bbc-news-site-introduces-dual-headlines-for-seo/)). BBC headlines averaged 5 words and 34 characters ([Nielsen Norman Group](https://www.nngroup.com/articles/worlds-best-headlines-bbc-news/)).
- **Front-load key words:** readers scan the first words of a headline ([Nielsen Norman Group](https://www.nngroup.com/articles/headings-pickup-lines/)). For news, place a main key word and at most one secondary phrase near the start, without keyword stuffing ([SEO for Journalism](https://www.seoforjournalism.com/p/three-tips-to-write-effective-seo)).
- **Attribution in headlines:** relying only on "police say" frames a story around one side ([Nieman Reports](https://niemanreports.org/articles/kansas-city-police-community-reporting)). Keep attribution or "alleged" in headlines on allegations, and seek other sources.

**The intro (summary or standfirst)**

- The BBC website's summaries are a single sentence in the present tense with the most important facts ([BBC website writing guide](https://www.slideshare.net/slideshow/guide-for-journos-writing-for-bbc-website/10074152)). A standfirst links the headline to the story ([Guardian Foundation glossary](https://theguardianfoundation.org/assets/files/behind-the-headlines-resources/behind-the-headlines-newspaper-terminology-aug-2021.pdf)).

**Types of lead**

- There are two families: **direct** (summary) leads for hard news, and **delayed** leads for features ([Columbia, Mencher](https://www.columbia.edu/itc/journalism/isaacs/client_edit/Mencher.html); [Poynter](https://www.poynter.org/educators-students/2017/2-types-of-leads-that-get-right-to-the-news/)).
- A **summary lead** gives the main news value and usually answers the Five Ws ([Ohio State](https://ohiostate.pressbooks.pub/stratcommwriting/chapter/summary-lead/)).
- A **delayed-identification lead** describes a person who is not well known and names them later. Well-known people are named first ([Intro to Journalism, ch. 8](https://pressbooks.pub/introjournalism/chapter/chapter-8-leads/)).
- **Impact leads** say how readers are affected; **updated leads** advance a known story ([Fiveable](https://fiveable.me/lists/types-of-news-leads)).

**How the senior editor uses this**

It writes:
- a **main headline** of 55–70 characters with key words first;
- a **short headline** of 30–45 characters;
- **two alternative headlines**;
- an **intro** of one sentence, 20–30 words, in the present tense, that does not repeat the headline;
- a **lead** of 20–35 words, of the type that fits the story (summary, delayed identification, attribution at the end, decision, statement, toll first, or follow-up).

These targets are in `lib/editor-lengths.js`.

## 4. Body

- **Inverted pyramid:** facts in descending order of importance ([Poynter](https://www.poynter.org/reporting-editing/2025/journalism-words-reporting-terms-off-the-record/), [Wikipedia](https://en.wikipedia.org/wiki/Inverted_pyramid_(journalism))).
- **Nut graf** (why the story matters) in the second or third paragraph, and a direct quote supporting the lead by the third or fourth. Source: Reuters Handbook; [Poynter on the nut graf](https://www.poynter.org/archive/2003/the-nut-graf-part-i/).
- **Attribution:** "said" is the default. Avoid "stated", "noted" and "commented". Keep "claimed" for assertions that are genuinely disputed, because it suggests doubt. Sources: [Patrick Phillips on AP's quotations entry](https://www.patrickkphillips.com/grammar/the-best-verb-for-quote-attribution-is-said/), [JGPR](https://jgpr.net/ap-style/), [Redpress](https://redpress.net/blog/ap-style-press-release/). The Indian newsroom habits "informed", "opined" and "added further" fall under the same rule.
- **Plain words:** prefer the short word; cut words that are not needed; prefer everyday English to jargon; use the active voice. Break any of these rules rather than write something clumsy. Source: The Economist Style Guide, after Orwell ([archived introduction](https://webarchive.library.unt.edu/web/20130114104813/http://www.economist.com/styleguide/introduction), [The Economist](https://econ.st/1acVGAk)).
- **No judgement words:** do not call news good, bad, shocking or horrendous; tell the story and let the reader decide. Prefer positive assertions ("The plan failed", not "The plan was not successful"). Use first, last, largest, unique or unprecedented only when the facts show it. Source: BBC News Styleguide.
- **"Occurred":** no source found bans the word. The principle above (short, everyday, active) argues for building the sentence around who did what, when and where ("A truck hit a scooter near the bridge at about 10 pm"), rather than "The accident occurred when…". "Took place" or "was held" suits planned events (a meeting, a rally); "happened" suits incidents when a verb of that kind is needed. A lexical database notes that "occur" can usually be replaced by "happen" ([VerbNet/PropBank](https://verbs.colorado.edu/propbank/framesets-english-aliases/occur.html)).

- **No ", prompting…" clauses.** A comma followed by "prompting", "leading to", "resulting in", "sparking", "highlighting" or "underscoring" chains two events into one sentence, which wire style avoids. It also states a cause the source may not have given, which attribution rules forbid, and it is a common habit of machine-written text. Write one event per sentence, in time order, and attribute any cause. *(House rule, added November 2026 after an editor's review of a live edit.)*

## 5. Crime, courts and fairness (India)

From the Press Council of India's Norms of Journalistic Conduct ([2010 official PDF](https://www.presscouncil.nic.in/WriteReadData/PDF/Norms2010.pdf); summaries: [Legal Desire](https://legaldesire.com/salient-features-of-press-council-of-indias-norms-of-journalistic-conduct-in-india/), [SCC Online](https://www.scconline.com/blog/post/2020/08/31/press-council-of-india-advises-media-to-adhere-norms-of-journalistic-conduct-in-covering-cases-under-investigation/)). The 2022 edition adds a norm on reporting arrests, raids and rescues ([PCI annual report 2022–23](https://mib.gov.in/sites/default/files/2024-05/pci-s-44th-annual-report-2022-23.pdf)).

- Do not publish the name, photograph or any identifying detail of a victim of rape, abduction or child sexual assault.
- Do not name the relatives or associates of an accused person when they are innocent and not relevant to the story.
- Do not describe an accused or a victim by caste or community unless it is relevant to the offence.
- Do not reveal, comment on or evaluate a confession the accused allegedly made.
- No "parallel trial": do not pronounce guilt or innocence, and do not give excessive publicity to suspects, victims or witnesses.

Presenting allegations as established fact is the most common presumption-of-innocence error in crime reporting ([Hungarian Helsinki Committee toolkit](https://helsinki.hu/en/wp-content/uploads/sites/2/2020/09/Toolkit_for_journalists.pdf), [Fair Trials](https://www.fairtrials.org/app/uploads/2022/01/Fair-Trials-Innocent-until-proven-guilty-The-presentation-of-suspects-in-criminal-proceedings_0.pdf)).

## 6. Ending (tail)

- The story ends with the least important material: background and context. It may end with a **kicker**, a final line that rounds the story off ([Poynter](https://www.poynter.org/reporting-editing/2025/journalism-words-reporting-terms-off-the-record/), [Wikipedia](https://en.wikipedia.org/wiki/Inverted_pyramid_(journalism))).
- Reuters closes with a credit line, for example "(Reporting by … ; Editing by …)" ([Kitco reprint](https://www.kitco.com/news/off-the-wire/2026-11-04/democratic-sweep-adds-new-twist-markets-iran-ai-and-debt-worries)). InsightNE shows the byline separately, so **the editor adds no credit line or byline**.
- What happens next (the next hearing, the polling date, the deadline) belongs near the end, if the report says it.

## 7. Indian numbers

- 1 lakh = 100,000 and 1 crore = 10 million. Indian grouping is 1,23,45,678 ([Wikipedia, Indian numbering system](https://en.wikipedia.org/wiki/Indian_numbering_system)). Indian English publications use lakh and crore ([Wikipedia, Lakh](https://en.wikipedia.org/wiki/Lakh)).
- *Unconfirmed:* no house rule from The Hindu or The Indian Express on numbers was found. InsightNE's rule is: one to nine in words, 10 and above in figures, "Rs 20", "per cent".

## Gaps for a second study

These could not be checked from this session and are worth reading in full if the network allow-list is opened: AFP's style guide, PTI's internal style book, the current AP Stylebook (subscription), the current Reuters Handbook ([trust.org](https://www.trust.org)), and the Guardian and BBC online style guides.
