# Retraining with the new labelled datasets (original / new / merged)

How the newly labelled Igbo/Yoruba data is prepared, how to select which dataset the
models train on, and how to run the retraining on the PC lab server (`pcl`).

> **Keep this file current.** If the dataset layout, the build script, or the
> `MODELING_DATASET_SOURCE` switch changes, update this guide in the same commit.

**Code:** `model_training/modeling/scripts/build_merged_dataset.py` (build),
`model_training/modeling/runtime_mode.py` + `model_training/modeling/common.py` (switch)

---

## 1. Dataset sources

| Source | Directory | Content |
|--------|-----------|---------|
| `original` (default) | `model_training/dataset/` | Existing thesis splits (`{lang}_{train,dev,test}.csv`). Never modified. |
| `new` | `model_training/new_dataset_split/` | Only the newly labelled data, cleaned and split 80/10/10 stratified (seed 42). Built artifact. |
| `merged` | `model_training/merged_dataset/` | train = original train + new train; **dev/test = exact copies of the original splits** so metrics stay comparable with all previous runs. Built artifact. |

Raw new data lives in `model_training/new_dataset/` (`igbo_dataset_labeled.csv`,
`yoruba_dataset_labeled.csv`) and is never modified. `new_dataset/`,
`new_dataset_split/`, and `merged_dataset/` are all gitignored (bulky data travels by
rsync, not git).

### What the build does (`build_merged_dataset.py`)

- Renames `text`→`tweet`, collapses whitespace/newlines to single spaces.
- Normalizes labels: strips whitespace, maps `Abusive`→`Abuse`, **drops `Invalid`**
  (150 yoruba rows; no counterpart in the 3-class scheme).
- Drops empty tweets; deduplicates on normalized text; drops duplicate groups with
  conflicting labels.
- Stratified 80/10/10 split of the new data (seed 42) → `new_dataset_split/`.
- Concatenates original train + new train → `merged_dataset/` (adds a `source` column);
  copies original dev/test unchanged.
- Self-verifies through the real loader: both roots load, merged dev/test are identical
  to the original benchmark, and zero new-train text leaks into the benchmark.
- Writes `model_training/merged_dataset/BUILD_REPORT.md` with all counts.

Current build (seed 42): igbo 7,086 → 6,939 clean rows (merged train 8,539);
yoruba 15,000 → 14,833 clean rows (merged train 15,194).

## 2. Selecting the source: `MODELING_DATASET_SOURCE`

Set the env var (or flip the `DATASET_SOURCE` constant in
`model_training/modeling/runtime_mode.py`):

```bash
export MODELING_DATASET_SOURCE=merged   # original | new | merged
```

Every entry point honors it — `run_finetune`, `run_baselines`, `run_eval`,
`run_explain`, notebooks — because dataset resolution lives in
`modeling/data.py` via `common.resolve_dataset_dir()`. With nothing set, behavior is
exactly the historic default (`original`). Each run records the source used in its
`metrics.json` under `dataset_source`.

Because quality differs between the datasets (different collection/labeling means),
compare sources on the **same benchmark**: train under each source, then compare
`test` macro F1 in `metrics.json` / the aggregate report (`run_eval --aggregate-only`).
The merged root keeps the original dev/test precisely so this comparison is fair.

## 3. Run it on the PC server

The datasets are gitignored, so code travels by **git** and data by **rsync**.

### 3.1 Push the code (from the Mac)

```bash
cd /Users/kingsleyeneja/Downloads/Dalhousie_MCS_courses/thesis/thesis_hasoc
git add model_training project_documentation plans
git commit -m "Add dataset-source switch and merged-dataset build for retraining"
git push origin ft-dashboard-ui
```

### 3.2 Copy the raw new data (from the Mac, once)

The server repo layout matches `model_training/` (bundle root contains `modeling/`,
`dataset/`). If your server checkout instead has the monorepo layout, the bundle root is
`~/thesis-hasoc-model-training/model_training/` — adjust the rsync target accordingly.

```bash
rsync -avz --progress \
  model_training/new_dataset/ \
  pcl:~/thesis-hasoc-model-training/new_dataset/
```

### 3.3 Pull, build, and verify (on the server)

```bash
ssh pcl
cd ~/thesis-hasoc-model-training
git pull

# Find the bundle root: it must contain modeling/ and dataset/
ls modeling dataset 2>/dev/null || cd model_training

source kc_train_venv/bin/activate   # or the env used previously on this server
python -m modeling.scripts.build_merged_dataset
```

Read the printed report: both languages must end with `verification OK`, and
`merged_dataset/BUILD_REPORT.md` is written.

### 3.4 Retrain

Full sweep (all 9 jobs, both languages + joint + cross-lingual — long, use tmux):

```bash
MODELING_DATASET_SOURCE=merged ./run_all.sh
```

Or a single model first to sanity-check the pipeline:

```bash
MODELING_DATASET_SOURCE=merged python -m modeling.scripts.run_finetune \
  --config modeling/configs/xlmr_base.yaml --lang igbo --full
```

To compare against other sources afterwards, rerun with
`MODELING_DATASET_SOURCE=original` or `=new`, then rebuild the aggregate report:

```bash
python -m modeling.scripts.run_eval --aggregate-only
```

## 4. Caveats (read before interpreting results)

- **Class priors shift.** Original igbo train is ~70% Abuse; new igbo is ~95% Normal.
  Merged igbo train lands at ~71% Normal / 25% Abuse / 4% Hate. Class-weighted loss is
  recomputed automatically, but expect precision/recall per class to move on the
  unchanged benchmark even when the model improves overall.
- **Domain shift.** Original data is Twitter-style (@mentions, hashtags, ~85–111 chars
  avg); new data is Facebook-style (no mentions, ~590–981 chars avg). The benchmark
  stays Twitter-style, so merged training measures cross-domain generalization.
- **More data ≠ guaranteed benchmark gains.** Treat `original` vs `new` vs `merged` as
  an experiment; keep whichever source wins on the unchanged test split.
- New-data dev/test exist only under `new_dataset_split/`; use
  `MODELING_DATASET_SOURCE=new` to evaluate in-domain on the new data.
- Five new rows were truncated at Excel's 32,767-char cell limit before labeling;
  the tokenizer truncates at 256 tokens anyway, so they are kept but harmless.
