# Plan: Retrain models with new datasets (merged / new-only / original)

**Date:** 2026-09-08
**Status:** Confirmed (benchmark decision: merged keeps old dev/test) — implemented
**Goal:** Improve model performance by retraining with the newly labelled Igbo/Yoruba data, with an env/constant switch to train on `original`, `new`, or `merged` data at will.

---

## 1. Analysis findings

### 1.1 Current training pipeline (`model_training/`)

- `modeling/common.py:12-15` — `DATASET_DIR = PROJECT_ROOT / "dataset"` is the single path root; not configurable today.
- `modeling/data.py` — loads `{dataset_dir}/{language}_{split}.csv`; requires columns `id,tweet,label`; labels are **strictly** validated against `["Normal", "Abuse", "Hate"]` (`normalize_label` raises on anything else). No cleaning, no dedup. Splits are pre-made on disk; the loader never splits.
- Class weights / sample weights are computed **dynamically** from the train frame (`compute_class_weights`, `data.py:77`), so a changed class distribution is handled automatically.
- Evaluation: macro/weighted F1, MCC, ROC-AUC, per-class metrics (`evaluate.py`); best model selected by `macro_f1` on **dev** with early stopping.
- `run_all.sh` runs the full sweep (9 fine-tune jobs: xlmr/afroxlmr/afriberta × igbo/yoruba + joint + 2 cross-lingual) then explainability + aggregate eval. It refuses to run under smoke mode.
- Env-var pattern already exists: `runtime_mode.py` (`SMOKE_TEST` constant + `MODELING_SMOKE` env override).

### 1.2 Dataset comparison

| | OLD `dataset/` | NEW `new_dataset/` |
|---|---|---|
| Files | `{igbo,yoruba}_{train,dev,test}.csv` | `igbo_dataset_labeled.csv` (7,086 rows), `yoruba_dataset_labeled.csv` (15,000 rows) |
| Columns | `id,tweet,label,length` | `id,text,label` (yoruba adds `batch` B1–B5) |
| Labels | `Normal, Abuse, Hate` | `Normal, Hate, **Abusive**`, yoruba also `**Invalid**` (150) + one dirty `'Abusive '` |
| Igbo train dist | Normal 25% / Abuse 70% / Hate 5% (2,988 rows) | Normal 95.5% / Abusive 1.7% / Hate 2.8% |
| Yoruba train dist | Normal 43% / Abuse 54% / Hate 3% (3,328 rows) | Normal 68.8% / Abusive 27.1% / Hate 3.1% |
| Style | Twitter: @mentions 76%/27%, hashtags, avg ~85–111 chars | Facebook-style: 0% mentions/hashtags, avg ~590–981 chars, 9,056 yoruba rows multi-line |
| Splits | already split | unsplit |

**Verified facts:**
- **Zero exact-text and zero ID overlap** between old and new (both languages) → merging causes **no train/test leakage** against the existing dev/test benchmark.
- New igbo has 141 duplicate copies (90 dup groups, 6 with conflicting labels) → must dedup.
- 5 rows sit at 32,767 chars (Excel cell limit → truncated mid-content). Harmless: tokenizer truncates at `max_length=256` tokens anyway. Left as-is.
- Label mismatches (`Abusive`, `Invalid`, `'Abusive '`) **will crash the current loader** — normalization is mandatory before merging.
- `new_dataset/` is gitignored ("ignore bulky extras") → the CSVs travel to the server via rsync, not git.

### 1.3 Will merging improve performance?

Honest assessment: **more and more-diverse data should improve robustness and Normal-class recall, but a gain on the existing test benchmark is not guaranteed**, because:

- **Class-prior shift:** merged igbo train flips from ~70% Abuse to majority Normal. Metrics on the unchanged old test set will shift even if the model is "better". Class-weighted loss mitigates, but the operating point changes.
- **Domain shift:** old data is Twitter-style, new data is Facebook-style (no mentions, much longer texts). This is realistic diversity, but the old test set remains Twitter-style.

Therefore the plan is **experimental**: train on `original` vs `new` vs `merged` under the *same unchanged benchmark* (old dev/test) and compare macro F1 / per-class F1. The env switch exists precisely so we can measure which source wins instead of assuming.

---

## 2. Design

### 2.1 Dataset sources and the switch

Three dataset roots, selected by one switch:

| Source | Directory | Content |
|---|---|---|
| `original` (default) | `model_training/dataset/` | untouched existing data |
| `new` | `model_training/new_dataset_split/` | new data only, stratified 80/10/10 train/dev/test (built by script) |
| `merged` | `model_training/merged_dataset/` | train = old_train + new_train; **dev/test = old dev/test unchanged** (benchmark stays comparable) |

Switch mechanism (mirrors the existing `SMOKE_TEST` pattern):

- `modeling/runtime_mode.py`: add `DATASET_SOURCE: str = "original"` constant + `MODELING_DATASET_SOURCE` env override + `effective_dataset_source()` (validates the value).
- `modeling/common.py`: add `resolve_dataset_dir()` mapping source → directory; `DATASET_DIR` stays as the `original` root.
- `modeling/data.py`: default `dataset_dir` resolves via `resolve_dataset_dir()`. All callers (trainer, baselines, eval, explain, notebooks) inherit the switch with **zero changes** to them.
- Record `dataset_source` in each run's saved metrics/config so runs stay traceable; run directory layout (`runs/<run_name>/<lang>/<ts>/`) is unchanged so backend/dashboard docs keep working.

Default stays `original` → **no behavior change unless the env/constant is set.**

### 2.2 New build script: `model_training/modeling/scripts/build_merged_dataset.py`

One offline step that produces both derived dataset roots deterministically (seed 42):

1. Read `new_dataset/{lang}_dataset_labeled.csv` with a real CSV parser (multi-line fields).
2. Clean: rename `text`→`tweet`; strip labels; map `Abusive`→`Abuse`; **drop `Invalid`** (150 yoruba rows, no counterpart in the 3-class scheme); drop empty tweets; normalize whitespace in text (newline/tab/run-of-spaces → single space) so merged CSVs stay one-row-per-line like the old files.
3. Dedup per language on normalized text: keep first occurrence; **drop groups whose duplicates disagree on the label** (~6 igbo groups — label noise).
4. Stratified split 80/10/10 → `new_dataset_split/{lang}_{train,dev,test}.csv`.
5. Build `merged_dataset/`: `{lang}_train.csv` = old_train + new_train (adds a `source` column: `original`/`new` — passes through the loader harmlessly); `{lang}_dev.csv` / `{lang}_test.csv` = exact copies of old dev/test.
6. Recompute `length`; prefix new-row ids as `new_{lang}_{original_id}` for traceability.
7. Write `merged_dataset/BUILD_REPORT.md` (row counts, label distributions, dropped-row audit) and print it.

### 2.3 Validation (zero-error requirement)

1. Run the build script locally; inspect `BUILD_REPORT.md`.
2. Unit-style check: for each source in {original, new, merged} × lang in {igbo, yoruba}, call `load_language_bundle` and assert shapes/labels (script or notebook cell).
3. End-to-end smoke train: `MODELING_SMOKE=1 MODELING_DATASET_SOURCE=merged python -m modeling.scripts.run_finetune --config modeling/configs/xlmr_base.yaml --lang igbo` (and once with `--lang yoruba`) → must finish with no errors.
4. Confirm default behavior unchanged: run loader with no env set and diff against current behavior.

### 2.4 Server retraining workflow (to document)

1. Local: commit + push code (build script, switch, docs). `new_dataset/`, `new_dataset_split/`, `merged_dataset/` stay gitignored.
2. `rsync` `new_dataset/` raw CSVs to `pcl:~/thesis-hasoc-model-training/model_training/new_dataset/`.
3. Server: `git pull`, run the build script there (verifies the pipeline on the server), then e.g. `MODELING_DATASET_SOURCE=merged ./run_all.sh` for the full sweep, or single configs via `run_finetune`.
4. Compare runs in `reports/` (aggregate eval picks up `dataset_source`).

### 2.5 Documentation updates

- `project_documentation/feature_description/retraining-with-new-datasets.md` (new): dataset v2, merge strategy, env switch, push-to-server + run instructions; register it in `feature_description/README.md`.
- `project_documentation/thesis/`: add dataset-v2/merge notes + caveats (class-prior shift, domain shift, Invalid dropped, dedup, benchmark kept unchanged).
- `model_training/README.md`: short "Dataset sources" section documenting `MODELING_DATASET_SOURCE`.
- `model_training/.gitignore`: add `new_dataset_split/` and `merged_dataset/`.

---

## 3. Files touched

| File | Change |
|---|---|
| `model_training/modeling/scripts/build_merged_dataset.py` | **new** — cleaning/dedup/split/merge + report |
| `model_training/modeling/runtime_mode.py` | `DATASET_SOURCE` constant + env override + `effective_dataset_source()` |
| `model_training/modeling/common.py` | `resolve_dataset_dir()` |
| `model_training/modeling/data.py` | default dir via `resolve_dataset_dir()` |
| `model_training/modeling/trainer.py` | save `dataset_source` into run metrics |
| `model_training/.gitignore` | ignore derived dataset dirs |
| `model_training/README.md` | document the switch |
| `project_documentation/feature_description/retraining-with-new-datasets.md` | **new** — full guide incl. server instructions |
| `project_documentation/feature_description/README.md` | register the guide |
| `project_documentation/thesis/` | dataset-v2 notes/caveats |

## 4. Explicit non-goals / caveats

- Old `dataset/` and `new_dataset/` raw files are **never modified**.
- Old dev/test stay the benchmark for `merged`; `new` source uses its own stratified splits.
- No re-splitting of old data; no changes to hyperparameters, models, or `run_all.sh` job list.
- Excel-truncated rows (5) kept — truncated again at tokenization; noted, not worth special handling.
- Performance gain is a hypothesis to be measured by the 3-source comparison, not a given.
