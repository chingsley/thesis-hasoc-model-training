# Dataset v2: merging newly labelled Igbo/Yoruba data

Design rationale, measurements, and limitations for retraining the hate-speech
classifiers with a second wave of labelled data. Operational how-to lives in
[`../feature_description/retraining-with-new-datasets.md`](../feature_description/retraining-with-new-datasets.md);
this document records the *why* and the caveats that belong in the thesis.

## Motivation

The original splits (`model_training/dataset/`) are small (2,988 igbo / 3,328 yoruba
train rows) and skewed toward Abuse (~70% of igbo train). A second collection wave
(`model_training/new_dataset/`, Facebook-sourced) added 7,086 igbo and 15,000 yoruba
labelled rows. Because the two waves were collected and labelled by different means,
their quality and distribution differ — so the training pipeline treats the dataset
choice as a **controlled experiment** rather than an assumption: a single switch
(`MODELING_DATASET_SOURCE=original|new|merged`) selects the training data, and all
sources are compared on one unchanged benchmark.

## Engineering summary

- `modeling/scripts/build_merged_dataset.py` cleans the new data (label mapping
  `Abusive`→`Abuse`, dropping `Invalid`, whitespace normalization, deduplication with
  conflict removal), creates a stratified 80/10/10 split (`new_dataset_split/`, seed 42),
  and writes `merged_dataset/` where **train = old train + new train** and
  **dev/test = the original splits, byte-for-byte in content**. The build self-verifies
  through the production loader: schema/label acceptance, benchmark identity, and zero
  train→benchmark leakage.
- The switch mirrors the existing `SMOKE_TEST` pattern: a constant in
  `modeling/runtime_mode.py` plus an env override, resolved once in
  `modeling/common.py::resolve_dataset_dir()` and consumed by `modeling/data.py`, so
  trainer/baselines/eval/explain/notebooks all honor it with no per-entry-point changes.
  Default is `original` — historic behavior is unchanged unless the switch is set.
- Every run records `dataset_source` in `metrics.json` for traceability.

## Measurements (build of 2026-09-08, seed 42)

| Language | Raw new rows | Kept after cleaning | New train/dev/test | Merged train | Merged train distribution |
|----------|-------------|---------------------|--------------------|--------------|---------------------------|
| Igbo | 7,086 | 6,939 (31 conflict-dup rows + 116 dups dropped) | 5,551 / 694 / 694 | 8,539 | Normal 70.9% · Abuse 25.4% · Hate 3.7% |
| Yoruba | 15,000 | 14,833 (150 `Invalid` + 17 dups dropped) | 11,866 / 1,483 / 1,484 | 15,194 | Normal 63.6% · Abuse 33.3% · Hate 3.1% |

Overlap audit: zero exact-text and zero ID overlap between the new data and the
original train/dev/test (both languages) — merging introduces no leakage into the
benchmark.

## Caveats and limitations (thesis-worthy)

- **Class-prior shift.** Original igbo train is ~70% Abuse / ~25% Normal; the new igbo
  data is ~95% Normal. The merged igbo train flips to ~71% Normal. Class-weighted loss
  is recomputed from the train frame automatically, but the decision threshold
  effectively moves: expect per-class precision/recall on the unchanged benchmark to
  shift even when overall robustness improves. Report per-class F1, not just macro F1.
  Full treatment: [class-imbalance-dataset-priors.md](./class-imbalance-dataset-priors.md).
- **Domain shift.** The original data is Twitter-style (@-mentions in 76% of igbo rows,
  hashtags, mean ~85–111 chars); the new data is Facebook-style (no mentions/hashtags,
  mean ~590–981 chars, multi-line posts). Since the benchmark stays Twitter-style,
  merged-source training measures *cross-domain generalization*. In-domain new-data
  performance is measurable separately via `MODELING_DATASET_SOURCE=new`.
- **Label semantics are assumed compatible.** `Abusive` (new) is treated as `Abuse`
  (original). If the new annotation guidelines defined "Abusive" more broadly or
  narrowly, the merge imports that bias; the 150 `Invalid` yoruba rows (1%) were
  excluded rather than mapped.
- **Truncated source rows.** Five new rows hit Excel's 32,767-char cell limit before
  labeling and are truncated mid-content; the tokenizer truncates at 256 tokens
  regardless, so impact is negligible.
- **Expected outcome is empirical, not assumed.** Merging roughly triples the train
  data and adds domain diversity, which should improve robustness and Normal-class
  recall; whether macro F1 on the original benchmark improves is exactly what the
  three-source comparison is designed to answer.
