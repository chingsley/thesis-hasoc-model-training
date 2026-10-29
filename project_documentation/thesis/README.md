# Thesis-writing documentation

Design-and-analysis documents written for the thesis itself — motivation, method,
measurements, trade-offs, limitations. Distinct from
[`../feature_description/`](../feature_description/), which documents *what each dashboard
feature does end-to-end* (operational, keep-current docs); this folder holds *why the system
is designed this way and how well it works* (thesis chapters/sections material).

| Document | Topic |
|----------|-------|
| [explainability-performance-architecture.md](./explainability-performance-architecture.md) | /explain latency redesign: content-addressed caching, concurrent XAI methods, tuned budgets, incremental frontend rendering — with measured speed-ups |
| [toxic-term-attribution.md](./toxic-term-attribution.md) | Two-view word clouds: frequency (targets) vs leave-one-out model attribution (toxic terms) — method, measurements, limitations |
| [data-provenance-collection-annotation.md](./data-provenance-collection-annotation.md) | Where the data come from: AfriHate re-split, Meta Content Library (Facebook) keyword collection, processing, annotation (Yoruba 5 annotators + agreement; Igbo status), merge, and the `MODELING_DATASET_SOURCE` switch — with open questions |
| [dataset-v2-merge.md](./dataset-v2-merge.md) | Retraining with the second-wave labelled data: merge strategy, `MODELING_DATASET_SOURCE` experiment design, class-prior/domain-shift caveats |
| [class-imbalance-dataset-priors.md](./class-imbalance-dataset-priors.md) | Class imbalance across the three training sources: the flipped prior, weighting/sampling/selection countermeasures, ratios vs. absolute counts, metric interpretation under train/test prior mismatch |
