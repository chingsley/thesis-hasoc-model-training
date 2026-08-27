# Distinguishing Toxic Terms from Toxic Targets: Two-View Word Clouds with Leave-One-Out Attribution

Thesis-facing write-up of the Analysis page's word-cloud design. Covers the problem with
frequency-only clouds, the two-view design, the attribution method, implementation, and an
empirical illustration on real dashboard data.

## 1. Motivation

A word cloud built from raw word frequencies over Hate/Abuse posts answers "which words appear
most in toxic posts?" — **not** "which words make these posts toxic?". The two diverge in
practice: in our Igbo test data the most frequent term was **"biafra"**, the *target* of the
abuse, which is not itself a toxic word. Frequency-only clouds therefore risk misleading
moderators and analysts by presenting targets as if they were toxic terms.

At the same time, the frequency view is genuinely useful — it identifies **targeted groups**
(e.g. "biafra" as an attack target), which is exactly what a hate-monitoring dashboard should
surface. The correct design is therefore not to replace the frequency cloud, but to
**complement it** with a second, model-measured view.

## 2. The two-view design

The Analysis → Toxic Word Cloud tab renders two side-by-side clouds over the same per-user
prediction log (Hate/Abuse posts only):

- **Cloud 1 — Frequent Terms in Toxic Posts.** Raw term frequency (stopword-filtered, words
  longer than 2 characters), top 40. Interpretation: *what is being talked about* — targets,
  topics, places, groups.
- **Cloud 2 — Most Toxic Terms.** Terms ranked by their **measured causal contribution** to the
  model's toxicity score (leave-one-out attribution, Section 3). Interpretation: *what carries
  the hate* — slurs, insults, and abuse markers.

## 3. Method: leave-one-out word attribution

Let `s(x) = 1 − p_normal(x)` be the model's toxicity score for text `x` (probability that the
text is **not** Normal, covering both Hate and Abuse). For each Hate/Abuse post `x` in the
user's log (newest 80, `TOXIC_TERMS_MAX_POSTS`) and each candidate word `w` in `x`:

```
drop(w, x) = s(x) − s(x \ w)        # toxicity lost when w is removed
contribution(w) = mean over posts containing w of drop(w, x)
value(w)        = contribution(w) × count(w)
```

- `contribution(w)` is a **per-occurrence** measure of how strongly the word itself drives the
  prediction — a target word like "biafra" scores low because removing it barely changes the
  toxicity score.
- `value(w)` ranks the cloud, requiring a word to be both **common and toxicity-driving**;
  words with contribution below 0.005 (pure context/targets) are excluded.

This is a deletion-based faithfulness measure in the same family as the AOPC/comprehensiveness
metrics used in the Explainability module — applied here at the corpus level rather than to
one post. No hardcoded lexicon is involved: the model itself identifies its toxic vocabulary,
so the method transfers across languages (Igbo/Yoruba) and domains without maintenance.

## 4. Implementation

- Endpoint: `GET /predictions/toxic-terms?language=` → `[{text, value, count, contribution}]`.
- Per-user and per-language, sourced from the SQLite prediction log (Hate/Abuse rows).
- Cost is bounded by construction: ≤80 posts × ≤25 unique candidate words per post, classified
  in batches of 16; an in-memory cache keyed `(user, language)` with fingerprint
  `(toxic post count, newest toxic post id)` makes repeat requests ~3 ms and invalidates
  automatically as new predictions arrive.
- The frontend (`ToxicWordCloud source="toxic"`) sizes words by `value` and exposes the
  frequency/contribution split on hover: `word: Nx in toxic posts, +X% toxicity per occurrence`.

## 5. Empirical illustration (measured)

Six seeded Igbo posts attacking "biafra" with explicit slurs, classified by the production
Igbo model (Apple M1, CPU; cold run ≈ 1.2 s):

| Term | Occurrences | Contribution/occurrence | value | Reading |
|------|------------:|------------------------:|------:|---------|
| mgbu | 2 | +0.659 | 1.318 | toxic driver |
| teroristi | 2 | +0.604 | 1.208 | toxic driver |
| **biafra** | **9** | **+0.095** | 0.856 | **frequent target, not toxic** |
| idiots | 2 | +0.340 | 0.679 | toxic driver |
| terrorist | 2 | +0.317 | 0.634 | toxic driver |

"biafra" is the most frequent term (9 occurrences) yet its per-occurrence contribution is 6–7×
lower than the true slurs. Cloud 1 shows it largest; Cloud 2 demotes it below "mgbu" and
"teroristi". The two views together separate **target identification** from **toxic-term
identification** — the original design goal.

## 6. Limitations

- **Single-word deletions** ignore multi-word expressions and word interactions (removing
  "useless" and "tribe" together may drop more than the sum of individual drops).
- **Model-defined toxicity**: `1 − p_normal` inherits the classifier's biases; an accurate
  cloud presupposes an accurate model.
- **Small logs are noisy**: a word seen once gets a one-sample estimate.
- The stopword list is minimal and English-leaning; extending it with Igbo/Yoruba function
  words would further clean both clouds.

## 7. Files

- `backend_api_server/app/analytics_service.py` — `user_toxic_terms` (attribution + cache)
- `backend_api_server/app/main.py` — `GET /predictions/toxic-terms`
- `frontend_dashboard/src/components/charts/ToxicWordCloud.tsx` — `source` prop (frequent/toxic)
- `frontend_dashboard/src/pages/Analysis.tsx` — two-cloud layout
- Feature-level flow: [../feature_description/analysis.md](../feature_description/analysis.md)
