# Class imbalance and dataset priors across the three training sources

Thesis material on how class imbalance shapes the retrained hate-speech classifiers:
what the imbalance actually is, what the pipeline does about it, what it does to the
metrics, and how the three-source experiment design settles the question empirically.
Companion to [dataset-v2-merge.md](./dataset-v2-merge.md) (merge mechanics) and
[`../feature_description/retraining-with-new-datasets.md`](../feature_description/retraining-with-new-datasets.md)
(operations).

## 1. Framing: the imbalance did not appear — it flipped

It is tempting to read "~70% Normal" in the merged training data as a new problem.
It is not new; the original dataset was imbalanced to the same degree in the opposite
direction (~70% **Abuse** in igbo train). Every model in this project has always been
trained under severe class imbalance. What changed with dataset v2 is **which class
dominates the prior**, plus a large increase in absolute data volume. The correct
question is therefore not "imbalance vs. no imbalance" but "which prior produces the
better classifier for the deployment task."

## 2. Measured distributions

Train-set label distributions (counts, %), build of 2026-09-08:

| Source | Igbo (rows) | Normal | Abuse | Hate |
|--------|------------|--------|-------|------|
| original train | 2,988 | 752 (25.2%) | 2,080 (69.6%) | 156 (5.2%) |
| new train (cleaned) | 5,551 | 5,301 (95.5%) | 93 (1.7%) | 157 (2.8%) |
| merged train | 8,539 | 6,053 (70.9%) | 2,173 (25.4%) | 313 (3.7%) |

| Source | Yoruba (rows) | Normal | Abuse | Hate |
|--------|--------------|--------|-------|------|
| original train | 3,328 | 1,418 (42.6%) | 1,808 (54.3%) | 102 (3.1%) |
| new train (cleaned) | 11,866 | 8,242 (69.5%) | 3,249 (27.4%) | 375 (3.2%) |
| merged train | 15,194 | 9,660 (63.6%) | 5,057 (33.3%) | 477 (3.1%) |

The evaluation benchmark never changes — it is the original dev/test splits in all
three arms: igbo test 717 rows (25.1% Normal / 69.7% Abuse / 5.2% Hate), yoruba test
817 rows (42.6% / 54.4% / 3.1%). Note the resulting **train/test prior mismatch** in
the merged arm: the model is trained on a Normal-majority distribution and tested on
an Abuse-majority one. This mismatch is deliberate (it preserves comparability with
all previous runs) but it shapes how results must be read (§5).

## 3. What the pipeline already does about imbalance

The countermeasures are structural, not tuned per dataset — they recompute from
whatever train frame is loaded, so they adapt to each source automatically:

- **Class-weighted cross-entropy** (`weighted_loss: true` in all full configs;
  `compute_class_weights`, `model_training/modeling/data.py:77`). Weights follow
  `total / (n_classes × class_count)`. Under merged igbo train this yields
  ≈ 0.47 (Normal) / 1.31 (Abuse) / 9.10 (Hate) — a Hate row contributes ~19× the
  gradient of a Normal row. Under original igbo train the equivalent weights are
  ≈ 1.33 / 0.48 / 6.38 (Abuse was the down-weighted class).
- **WeightedRandomSampler** (`weighted_sampler: true`, afriberta config): oversamples
  minority classes per batch, complementing the loss weighting.
- **Focal loss** (`focal_loss_gamma: 2.0`, afriberta config): down-weights easy
  majority examples further.
- **Macro-F1 model selection**: best-checkpoint selection and early stopping optimize
  the unweighted mean of per-class F1 (`metric_for_best_model: macro_f1`). A trivial
  "always predict the majority class" model scores ≈ 0.23 macro F1 under a 70/25/4
  split and can never win selection.
- **Imbalance-robust reporting**: every run records per-class precision/recall/F1,
  MCC, and ROC-AUC (OvR macro) alongside accuracy and weighted F1.
- **Targeted augmentation**: `modeling/augment.py` augments **Hate rows only**
  (EDA; optional NLLB back-translation), directly attacking the scarcest class.

## 4. Ratios vs. absolute counts: the underappreciated benefit

Ratio analysis alone makes the merged data look strictly worse for minority classes.
Absolute counts tell the more important story — minority-class *examples* grew
substantially even as their *share* shrank:

| Class | Igbo: original → merged | Yoruba: original → merged |
|-------|------------------------|---------------------------|
| Normal | 752 → 6,053 (8.0×) | 1,418 → 9,660 (6.8×) |
| Abuse | 2,080 → 2,173 (+4.5%) | 1,808 → 5,057 (2.8×) |
| Hate | 156 → 313 (2.0×) | 102 → 477 (4.7×) |

Gradient-based models are limited more by the number of minority examples they see
(and their diversity) than by the raw ratio, especially once the loss rebalances the
classes. The merged Hate sets are also more *diverse* (Facebook-style long posts in
addition to tweets), which matters for generalization to real deployment text.

## 5. Expected effects, and how to read the metrics

Qualitative expectations for the merged arm on the unchanged benchmark:

- **Normal recall up** (larger, more diverse Normal data; prior now favors Normal).
- **Abuse recall down** relative to the original arm: the prior shift moves the
  decision boundary, and Abuse is now the mid-weight class instead of the majority.
- **Hate: genuinely uncertain.** The ratio worsened (5.2% → 3.7% igbo) but absolute
  data doubled-to-quintupled and loss weighting is strongest here. Either effect can
  dominate; this is the class to watch.
- **Metric interpretation under prior mismatch.** Because the benchmark remains
  Abuse-heavy (igbo) while merged training is Normal-heavy, *weighted* F1 and plain
  accuracy can drop even when the model is arguably better calibrated; conversely a
  Normal-boosted model can inflate weighted F1 on a Normal-heavy slice without real
  improvement. The honest lenses are **macro F1**, **per-class F1/recall**, and
  **MCC**. Weighted metrics should be reported with the prior mismatch explicitly
  acknowledged.
- The **new-only** arm is the extreme case (igbo train 95.5% Normal) and exists as a
  diagnostic boundary of the design space, not as a deployment candidate.

## 6. External validity: which distribution is the "right" one anyway?

The benchmark is Twitter-style and Abuse-heavy because the original HASOC-style
collection was. The deployment setting (monitoring real community content, as in the
new Facebook-sourced wave) is plausibly much closer to the new data's distribution —
long posts, no @-mentions, Normal-majority. A merged-source model may therefore be
*better in production* even if its benchmark macro F1 dips, because the benchmark
itself under-represents the deployment domain. Two implications for the thesis:

1. Benchmark comparisons answer "which source wins on the original task definition?"
  — a fair, controlled question, and the right primary analysis.
2. A secondary evaluation on the new-data test split
  (`MODELING_DATASET_SOURCE=new` provides one per language) measures in-domain
  performance and should be reported alongside, so the deployment-relevance argument
  is evidenced rather than asserted.

## 7. Mitigation levers if merged underperforms

Ordered by implementation cost, all compatible with the existing switch:

1. **Config-only**: extend `weighted_sampler: true` and/or `focal_loss_gamma` to the
   xlmr/afroxlmr configs (both mechanisms already exist and are proven in the
   afriberta config).
2. **Prior shaping in the build script**: cap the Normal fraction taken from the new
   data (e.g. `MAX_NEW_NORMAL_RATIO` in `build_merged_dataset.py`) so the merged
   train prior lands closer to the benchmark's; this is a one-function change and the
   build stays deterministic.
3. **Hate-targeted augmentation on merged data**: enable `eda: true` for the merged
   arm (augmentation already targets Hate only).
4. **Post-hoc threshold tuning** per class on dev probabilities (not currently in the
   pipeline; would need a small addition to `evaluate.py`).

## 8. Bottom line

The ~70% Normal share in merged training data changes the model's operating point,
not its viability: loss re-weighting, minority-oversampling options, macro-F1 model
selection, and imbalance-robust metrics are already in place, and the absolute supply
of minority-class examples roughly doubled (igbo Hate) to quintupled (yoruba Hate).
Whether the net effect improves the benchmark is an empirical question — which is
precisely what the `original` / `new` / `merged` comparison on the unchanged test
splits is designed to answer in a single `run_all.sh` sweep per source.
