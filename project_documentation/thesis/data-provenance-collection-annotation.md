# Data provenance, collection, annotation and merging

**Purpose:** reference for writing the thesis chapters on data (Chapter 3, System Design and Development; Chapter 5 results; Chapter 6 limitations). It records:
- where every training and evaluation file comes from;
- how the second-wave data were collected from the Meta Content Library (MCL) and annotated;
- how they were merged with AfriHate;
- which switch selects the dataset.

**Status:** compiled on 2026-10-28 from:
- the author's account;
- a read-only audit of the files, scripts and git history;
- direct checks.

Statements are marked **[verified]** (checked directly against files or code), **[audit]** (computed in the read-only audit, not yet independently recomputed) or **[author]** (the author's account, not yet confirmed by files). Open questions are collected in Section 9.

Path prefixes used below:
- `B` = `~/Downloads/Dalhousie_MCS_courses/thesis`
- `FC` = `B/thesis_prism/facebook_collection`
- `MT` = `B/thesis_hasoc/model_training`

---

## 1. Overview: three dataset roots

| Root | Content | Used for |
|---|---|---|
| `MT/dataset/` ("original") | AfriHate posts, **re-split by the project** (Section 2) | Original benchmark: train, dev, test |
| `MT/new_dataset/` → `MT/new_dataset_split/` ("new") | Second-wave Facebook posts from MCL, annotated by the project (Sections 3–5) | Stand-alone train/dev/test, 80/10/10 |
| `MT/merged_dataset/` ("merged") | Original train **plus** new train; dev and test = **original** dev and test (Section 6) | Retraining with more data, evaluated on the unchanged original benchmark |

## 2. The "original" splits are AfriHate, de-duplicated and re-split [verified]

**Source copy.**
- The AfriHate Igbo and Yoruba splits were downloaded from Google Drive in March 2026: `B/thesis_dataset/dataset-20260307T192855Z-1-001.zip`, unzipped as `B/thesis_dataset/dataset/`. The zip also holds the AfriHate paper.
- Its sizes match AfriHate's official splits (paper, Table 7):
  - Igbo: train 3,419, dev 763, test 821, against 3,419 / 774 / 821 in the paper. The dev split has 11 fewer posts than the paper reports; the reason is unknown.
  - Yoruba: train 3,336, dev 724, test 819, exactly as in the paper.
- Labels: Normal = neutral, Abuse = abusive, Hate = hate.

**Problems found in the official splits** (`B/thesis_prism_copy/dataset_v1_clean/data_audit_report.md`, re-checked on 2026-10-28):
- **Igbo:** 633 exact-duplicate texts, and texts shared *across* splits: 120 between train and dev, 137 between train and test, and 23 between dev and test. These risk inflated test scores.
- **Yoruba:** 24 duplicates; 4–6 shared between each pair of splits.
- Some files held IDs from other splits (e.g., `train_` IDs inside dev and test files).

**Re-split procedure** (`B/thesis_prism/scripts/rebuild_dataset_v1_clean.py`, the "Dataset v1 Clean" step):
1. Merge each language's train, dev and test; strip whitespace; drop empty texts.
2. Remove duplicates by exact text, keeping the first occurrence in the order train, dev, test.
   - Igbo: 5,003 → **4,372** (631 removed).
   - Yoruba: 4,879 → **4,867** (12 removed).
3. Re-split with stratification by label, using scikit-learn `train_test_split`:
   - seed 42 for train vs. the rest, then seed 43 for dev vs. test;
   - **fixed sizes** that keep the original split proportions:
     - Igbo: train 2,988 / dev 667 / test 717;
     - Yoruba: train 3,328 / dev 722 / test 817.
4. Regenerate IDs as `{split}_{language}_{index:05d}` and recompute `length`.
5. Assert zero text overlap between train, dev and test.
6. Output `dataset_v1_clean/`. This is **byte-identical** to `MT/dataset/` (MD5 checked for all six files); it was carried into `thesis_hasoc` in the "Project reorganization" commit (36040c8, 2026-07-09).

The script and its audit report live only in the earlier `thesis_prism` project, not in `thesis_hasoc`. Copy both into `thesis_hasoc` if the re-split must be reproducible from this repository.

**Label distribution after the re-split** (data audit report):

| | Total | Train | Dev | Test |
|---|---|---|---|---|
| Igbo (Abuse / Normal / Hate) | 3,044 / 1,100 / 228 | 2,080 / 752 / 156 | 464 / 168 / 35 | 500 / 180 / 37 |
| Yoruba (Abuse / Normal / Hate) | 2,644 / 2,074 / 149 | 1,808 / 1,418 / 102 | 392 / 308 / 22 | 444 / 348 / 25 |

**Mapping to the official splits** (from the Drive copy):

| | From official train | From official dev | From official test |
|---|---|---|---|
| Igbo, our train (2,988) | 2,106 | 436 | 446 |
| Igbo, our dev (667) | 484 | 92 | 91 |
| Igbo, our test (717) | 507 | 99 | 111 |
| Yoruba, our train (3,328) | 2,312 | 480 | 536 |
| Yoruba, our dev (722) | 492 | 106 | 124 |
| Yoruba, our test (817) | 532 | 136 | 149 |

The public Hugging Face copy `mteb/AfriHateClassification` is the official splits with duplicates removed. It gives the same mapping.

**Reporting consequences:**
- Our test scores are **not directly comparable** with those published in the AfriHate paper (Muhammad et al., NAACL 2025). The test sets differ, and ours is free of the duplicates that leak across AfriHate's official splits.
- Do not evaluate our models on AfriHate's official test set: our training split contains 446 of its Igbo and 536 of its Yoruba posts.
- In the thesis, justify the re-split by the cross-split duplication found in the official Igbo splits.
- `class-imbalance-dataset-priors.md` calls this data "HASOC-style"; it is AfriHate.

## 3. Second-wave collection from the Meta Content Library [verified unless marked]

**Source.**
- All rows are **Facebook** posts: every `mcl_url` contains `/facebook/post/`, and there is no Instagram data.
- All rows were matched on post text (`match_type = ["post_text"]`).
- The MCL language field is `ig` (Igbo) or `yo` (Yoruba) throughout, which suggests an MCL language filter [audit].
- Each export has 36 columns: post id, text, creation time, post-owner and surface fields, reaction/comment/share counts, and others [audit].
- Post dates span 2010–2026. The searches ran in June 2026 (Igbo about 7–11 June; Yoruba about 20 June, with four files added about 27 June); these dates are inferred from file timestamps and the latest post dates [audit].

**Search keywords.** Each download file name encodes the keyword searched in MCL [author]. The terms are hate or abusive words, group labels, or polarizing names, including Nigerian political figures [author]. Igbo glosses were supplied by the author, a native Igbo speaker. Yoruba glosses come from file names or code comments, as marked below.

**Igbo raw downloads** (`FC/igbo/`; 10 files; 15,175 rows; 14,450 unique post IDs) [audit counts]:

| File (keyword) | Rows | Notes |
|---|---|---|
| `igbo-alakuba` | 149 | an insulting term for Muslims [author] |
| `igbo-awusa` | 343 | a term for northern Nigerians or Muslims, depending on context. Not abusive by itself, but can be combined with other harmful terms to make a post abusive or hateful [author] |
| `igbo-fulani` | 453 | ethnic group name |
| `igbo-indi_ofe_mmanu` | 194 | *ndị ofe mmanụ*: an offensive term for Yoruba people [author] |
| `igbo-keyword-biafra` | 4,810 | region and secession movement |
| `igbo-muslim` | 133 | religious group |
| `igbo-ndi_ala` | 5,332 | context-dependent: "crazy people" (abusive or hateful, depending on use) or "people of the land" (normal) [author] |
| `igbo-terrorist-keyword-dataset` | 159 | "terrorist" |
| `igbo-tinubu` | 3,363 | political figure (Bola Tinubu) |
| `igbo-umu_agu` | 239 | context-dependent: "hungry people" or "lion children" [author] |

**Yoruba raw downloads.** The pipeline used the 18-file set in `FC/yoruba/`, as the 18 `search_keyword` values in the annotation file match it exactly [audit]. Glosses in quotation marks come from the file names; "(code)" glosses come from comments in `FC/prune_to_15k.py`.

| File (keyword) | Rows | Gloss |
|---|---|---|
| `yoruba_atiku` | 3,315 | (code) political figure (Atiku Abubakar) |
| `yoruba_biafra` | 503 | (code) region name |
| `yoruba_eranko` | 4,859 | (code) animal / beast |
| `yoruba_nnamdi_kalu` | 48 | (code) person's name (Nnamdi Kanu, spelled "kalu" in the file name) |
| `yoruba_odale` | 1,997 | (code) traitor |
| `yoruba_odale-traitor` | 2,035 | "traitor" (near re-download of `odale`: 1,958 shared IDs) |
| `yoruba_ole` | 16,302 | (code) thief / lazy |
| `yoruba_oloriburuku` | 4,009 | (code) cursed / unlucky person |
| `yoruba_olosho` | 1,140 | (code) prostitute |
| `yoruba_olosho (1)` | 850 | same keyword, different download (16 shared IDs) |
| `yoruba_omo_ibo` | 3,011 | (code) Igbo person, can be derogatory |
| `yoruba_omoale` | 115 | (code) bastard |
| `yoruba_omugo` | 1,034 | (code) fool |
| `yoruba_oponu` | 1,428 | (code) fool |
| `yoruba_peter_obi` | 2,266 | (code) political figure (Peter Obi) |
| `yoruba__ eniyan-fulani__fulani-people` | 543 | "Fulani people" (file name has a leading space) |
| `yoruba__aniyan-igbo__igbo-people` | 2,580 | "Igbo people" (file name spells *aniyan*, not *eniyan*) |
| `yoruba__asewo__prostitute` | 973 | "prostitute" |

The Desktop folder `~/Desktop/meta-content-library-downloads/yoruba/` (16 files) is an **earlier** set; checked by MD5 hash [audit]:
- 13 of its files are identical to the corresponding files in `FC/yoruba/`.
- It also has `yoruba_aje--witch.csv` (33,893 rows; "witch"), which was **not** used in the final pipeline. The author dropped it because the search did not return useful results [author].
- Its `yoruba_omo_ibo.csv` is a 678-row subset of the 3,011-row file.
- Git history of `thesis_prism` shows the switch from this set to the 18-file set (commits b08c5f7 and 414c94b) [audit].

**Sampling.** This is a **purposive, keyword-driven** sample, not a random sample of Igbo or Yoruba Facebook. For Yoruba it was further filtered by a lexicon score (Section 4), so describe it as such in the thesis.

## 4. Processing from raw downloads to annotation batches [audit]

**Yoruba** (scripts in `FC/`):
1. `process_facebook.py`:
   - keeps id, owner username, content type and text;
   - normalizes text;
   - sets `search_keyword` from the file name;
   - deduplicates text within, then across, files.
   - Counts: 47,008 → 35,588 → 31,699 rows.
2. Removes "Part N" captions: −471 → 31,228.
3. A langdetect English filter (probability > 0.70, seed 42) moves 6,285 mostly-English posts out.
4. 575 posts starting with "#" are set aside. **No script found.**
5. `clean_yoruba.py`:
   - removes URLs, e-mails, hashtags, @mentions, phone numbers, spam strings and emoji/punctuation runs;
   - drops texts with fewer than 2 words and some spam patterns.
   - Result: 24,159 rows.
6. `prune_yoruba_to_15k.py`:
   - deduplicates (→ 23,443);
   - scores each post with a Yoruba/English hate and offensive lexicon (0.7 × lexicon matches + 0.3 × keyword prior; priority = 1.5 × hate + 1.0 × offensive);
   - keeps the **top 15,000**, shuffled with seed 42.
   - **Caveat:** lexicon terms are matched as substrings without word boundaries.
   - About 47% of the kept posts come from the `ole` keyword.
7. Batching: 15,000 posts → five batches B1–B5 of 3,000. **No batching script was found.**

**Igbo:**
1. The same first steps give 15,175 → 12,711 → 12,052 → 11,821 rows.
2. A langdetect English split and an **undocumented cleaning step** then leave **7,118** posts (`FC/processed_for_annotation/igbo/facebook_igbo.csv`). No script for this cleaning was found.
3. `strip_english_igbo.py` writes the mostly-English posts (1,630 rows) to `igbo_mostly_english.csv`; they were not annotated.
4. There was no lexicon pruning. The 7,118 posts were split into batches B1 and B2 (3,559 each), each prepared for two annotators (A1, A2).
5. `B/thesis_prism/scripts/add_hate_type_igbo.py` added `hate_type` and `comment` columns.

## 5. Annotation

**Label scheme** (batch workbooks; Yoruba guideline `B/thesis_prism/ANNOTATION_GUIDELINE.md`) [audit]:
- Labels: **Hate**, **Abusive**, **Normal**, **Invalid** (with a reason: mostly English, not the target language, gibberish, other).
- Hate posts also get a target: ethnic, religious, gender, homophobia, political, disabilityphobia, xenophobic, racial, ageism, class, economic, other.
- Recruitment message: `B/thesis_prism/keeps/WHATSAPP_INTRO.md`.
- The guideline describes paid annotators, a screening quiz and a "no AI tools" rule.
- Each batch workbook has a "Guidelines" sheet.

### 5.1 Yoruba: five native-speaker annotators, every post double-labelled [verified structure; audit statistics]

- **Five annotators A1–A5**, in rotating pairs: B1 = A1 + A5, B2 = A1 + A2, B3 = A2 + A3, B4 = A3 + A4, B5 = A4 + A5.
  - Workbooks: `FC/processed_for_annotation/yoruba/annotation_batches/B#/B#_A#_yoruba.xlsx` [verified].
  - Each annotator labelled 6,000 posts, and every post was labelled by exactly two annotators [audit].
- **Final label:**
  - Agreements were kept as they were.
  - Disagreements (`B#_diff.xlsx`) were resolved into an `agreed_label`, by the annotator pair discussing them according to the guideline. The resolved label matched one annotator in 1,520 cases, the other in 1,270, and neither in 154.
  - `create_labeled_final.py` then merged the two files.
  - A later **hate-target review** relabelled 242 of 712 Hate posts (233 to Abusive, 9 to Normal), leaving **470 Hate** [audit]. The author chose not to document the reviewer or criteria further. If the thesis mentions the review, describe it only as a second-pass check of Hate labels.
- **Inter-annotator agreement** [audit]:
  - **Data:** n = 14,973 double-labelled posts. Each annotator's independent label was rebuilt from the agreed and diff files and checked against the per-annotator workbooks.
  - **Pooled, 4 classes:** observed agreement 0.805; **Fleiss' κ = 0.589**; Krippendorff's α (nominal) = 0.589.
  - **Other cuts:** excluding Invalid, κ = 0.602; Hate vs not-Hate, κ = 0.353; Hate+Abusive vs Normal, κ = 0.720.
  - **Per class:** Normal 0.907, Abusive 0.657, Hate 0.402, Invalid 0.354.
  - **Per batch:** Cohen's κ 0.553 (B1), 0.586 (B2), 0.594 (B3), 0.639 (B4), 0.582 (B5).
  - Annotators differed widely in how often they chose Hate; for example, in B1 one annotator chose Hate 59 times and the other 424 times.
  - **Recompute these figures with a committed script before reporting them.**
- Hate targets of the final Hate posts: religious 254, ethnic 118, other 32, political 26, xenophobic 17, gender 14, racial 4, disability 1, missing 4. These are **not** carried into the training CSVs [audit].

### 5.2 Igbo: same annotation process as Yoruba [author]

The Igbo data were annotated with **the same process as the Yoruba** (Section 5.1):
- five native-speaker annotators;
- each post labelled independently by two annotators, in rotating pairs;
- disagreements resolved by the pair;
- the same label scheme (Hate, Abusive, Normal, Invalid, with hate targets) and guideline (Igbo version).

Report Igbo exactly as Yoruba is reported: label counts, batch and annotator-pair structure, and inter-annotator agreement (Fleiss' κ / Krippendorff's α, pooled, per class and per batch).
- Compute the agreement from the Igbo annotation files with the same script as for Yoruba.
- Take the counts from `MT/new_dataset/igbo_dataset_labeled.csv` and `MT/merged_dataset/BUILD_REPORT.md`.

## 6. Conversion and merge [verified logic and counts]

**`MT/new_dataset/`:**
- `yoruba_dataset_labeled.csv`: 15,000 rows (Normal 10,318; Abusive 4,061, plus 1 with a trailing space; Hate 470; Invalid 150) [audit].
- `igbo_dataset_labeled.csv`: Igbo labelled set (Section 5.2).

**`MT/modeling/scripts/build_merged_dataset.py`** [audit; counts match `MT/merged_dataset/BUILD_REPORT.md`]:
- **Label normalization:** strip whitespace; `Abusive` → `Abuse`; drop anything else (this removes Yoruba Invalid).
- **Text cleaning:** whitespace collapsed; empty texts dropped.
- **Deduplication** on normalized text **within the new data only**. Groups with conflicting labels are dropped. There is no text or ID overlap with the AfriHate splits.
- **New splits:** stratified 80/10/10 (seed 42) into `MT/new_dataset_split/`.
- **Merged splits:**
  - merged train = original train + new train (with a `source` column);
  - merged dev and test = **original** (AfriHate re-split) dev and test, checked by the built-in `verify()`.

Counts as produced by the latest build (`MT/merged_dataset/BUILD_REPORT.md`); re-read them after any rebuild.

| | Igbo | Yoruba |
|---|---|---|
| New rows kept | 6,939 | 14,833 |
| new_dataset_split train / dev / test | 5,551 / 694 / 694 | 11,866 / 1,483 / 1,484 |
| merged train (Normal / Abuse / Hate) | 8,539 (6,053 / 2,173 / 313) | 15,194 (9,660 / 5,057 / 477) |
| merged dev / test | 667 / 717 (= original) | 722 / 817 (= original) |

## 7. Which switch selects the dataset [verified]

**Training (`MT/modeling/runtime_mode.py`):**
- The environment variable **`MODELING_DATASET_SOURCE`** = `original` | `new` | `merged` selects the root.
- If it is unset, the code uses the constant **`DATASET_SOURCE = "merged"`**.
- **The code default is therefore `merged`.** The comment above the constant ("Default keeps historic behavior") and several documents say the default is `original`:
  - `MT/README.md`;
  - `feature_description/retraining-with-new-datasets.md`;
  - `thesis/dataset-v2-merge.md`.
- Each run records the source used as `dataset_source` in its `metrics.json`.
- `steps_to_retrain.md` set `MODELING_DATASET=merged`, a variable no code reads. Its earlier merged run used merged data only because of the default. The guide was corrected on 2026-10-28 to `MODELING_DATASET_SOURCE`.
- **For thesis runs, set the variable explicitly** (`original` or `merged`) and report it.

**Backend (served models):**
- `HF_MODEL_SET` = `original` (alias `v1`) or `merged` (alias `v2`) in `backend_api_server/.env`.
- With `merged`, only the `HF_MODEL_ID_{IGBO,YORUBA,JOINT}_MERGED` variables are used.
- The local `.env` sets no `HF_MODEL_SET`, so the **original** models are served.

**Documented merged-model results** (single runs; AfroXLMR-base; test macro-F1 on the original test split; from `upload-model-to-huggingface.md`):

| Model | Macro-F1 (merged) | Macro-F1 (original, for comparison) |
|---|---|---|
| Igbo | 0.8398 | 0.8601 |
| Yoruba | 0.6076 | 0.6717 |
| Joint | 0.7256 | 0.7252 |

- The run folders are not on this machine.
- Report results as the mean ± SD over several seeds, not single runs.
- Re-run the merged models after any update to the labelled data, and report the results of the final runs.

## 8. Where this goes in the thesis

- **Chapter 3 (data):**
  - AfriHate as the base corpus, and how it was re-split;
  - the MCL collection: Facebook, keyword-driven, dates, keyword table;
  - the processing pipeline and the annotation procedure;
  - the merge design.
- **Chapter 2 claims to check:**
  - R1 ("build Igbo and Yoruba corpora … building on AfriHate") holds for Yoruba;
  - R2 (several trained native speakers label each post independently, with adjudication and reported agreement) is met for **both Yoruba and Igbo**: each post was labelled by 2 of 5 native-speaker annotators, disagreements were resolved, and agreement is reported;
  - §2.6.2 ("Native speakers … label the corpus") holds for both languages.
- **Chapter 5:** state for every result which dataset source trained the model, and report variation across seeds.
- **Chapter 6 (limitations):**
  - a purposive, lexicon-biased Yoruba sample;
  - Facebook only;
  - agreement for Hate is only moderate (e.g., Yoruba Hate vs not-Hate κ = 0.35; report the Igbo equivalent);
  - test scores not comparable with AfriHate's.

## 9. Open questions and decisions

**Resolved (2026-10-28):**
- **AfriHate re-split:** done by `rebuild_dataset_v1_clean.py` (Section 2).
- **Dropped keyword *aje*:** the search did not return useful results [author].
- **Yoruba hate-target review:** the author chose not to document it further.
- **Ethics review of annotation:** according to the author, the Dalhousie REB responded that the annotation work did not need ethics review; only the research evaluation with participants (the dashboard user study) does [author]. Keep that written response for the thesis's ethics statement.
- **Igbo annotation process:** the same as Yoruba (Section 5.2).

**Open:**
1. **Duplicate downloads:** why were *olosho* and *odale* downloaded twice? Minor.
2. **Undocumented steps.** There are no scripts for Yoruba batching, the Igbo cleaning step, the "#"-start split, or the xlsx→csv conversions (some were done through AI-assistant prompts). Describe these as manual steps in the thesis.
3. **Data governance.** Raw MCL exports with post-owner names and usernames are tracked in a GitHub repository (`masters_thesis`), and the labelled CSVs with MCL post IDs in `thesis-hasoc-model-training`. The author will make the repository private if it is not already. Check the MCL terms of use before any data release.
4. **The 11 missing Igbo dev posts.** The Drive copy's Igbo dev split has 763 posts, against 774 in AfriHate's Table 7. Minor; the source of the Drive copy may explain it.
