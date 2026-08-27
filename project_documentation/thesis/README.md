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
