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
`yoruba_dataset_labeled.csv`) and is never modified. The dataset roots are
**git-tracked** (the `.gitignore` entries were removed on 2026-09-09) so the raw data
travels by git like the code. `merged_dataset/` and `new_dataset_split/` are
deterministic build artifacts — each machine regenerates them via §3 step 4; expect
them to show as untracked after a build unless you choose to commit them.

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

## 3. Run the retraining on the PC server (exact runbook)

Code **and data** travel by **git** — the `.gitignore` entries for `new_dataset/`,
`new_dataset_split/`, and `merged_dataset/` were removed (2026-09-09), so the raw data
is tracked and pushed like any other file. No rsync needed. The **bundle root** is the
directory that contains `run_all.sh`, `modeling/`, and `dataset/` (`model_training/`
inside the monorepo).

### 0. One-time on the Mac — publish the raw data

Skip if the server already has `new_dataset/`. Otherwise commit and push it:

```bash
cd /Users/kingsleyeneja/Downloads/Dalhousie_MCS_courses/thesis/thesis_hasoc
git add model_training/.gitignore model_training/new_dataset
git commit -m "Track new_dataset so the server can build merged_dataset"
git push origin ft-dashboard-ui
```

(`merged_dataset/` and `new_dataset_split/` are deliberately **not** committed — the
server regenerates them in step 4, which also self-verifies them.)

### 1. Server: go to the repo root and get the latest code

```bash
cd ~/thesis-hasoc-model-training 2>/dev/null || cd /data/disk1/$USER/thesis-hasoc-model-training
git checkout ft-dashboard-ui && git pull
```

If `git pull` fails with "diverged branch" (history was rebased/force-pushed), and
`git status` shows no local work you care about on the server:

```bash
git fetch && git reset --hard origin/ft-dashboard-ui
```

### 2. Server: enter the bundle root and verify layout — code AND data

```bash
ls run_all.sh >/dev/null 2>&1 || cd model_training
ls run_all.sh modeling dataset modeling/scripts/build_merged_dataset.py \
  new_dataset/igbo_dataset_labeled.csv new_dataset/yoruba_dataset_labeled.csv
```

Every path must list without error. If `build_merged_dataset.py` is missing → wrong
branch, back to step 1. If a `new_dataset/` file is missing → step 0 was not pushed or
not pulled.

### 3. Server: verify the venv

`run_all.sh` auto-detects the venv — first match wins: `$VENV_DIR` override → an
already-activated venv (`$VIRTUAL_ENV`) → `<bundle>/kc_train_venv` →
`<repo-root>/kc_train_venv`. No symlink or manual activation needed. Just confirm one
exists at the repo root:

```bash
ls ~/thesis-hasoc-model-training/kc_train_venv/bin/activate
```

If missing, create it (shared torch comes from the system site packages on this server):

```bash
python -m venv --system-site-packages ~/thesis-hasoc-model-training/kc_train_venv
source ~/thesis-hasoc-model-training/kc_train_venv/bin/activate
pip install -r requirements-modeling.txt
```

### 4. Server: build + verify the merged dataset

`merged_dataset/` does not ship in git — generate it:

```bash
source ../kc_train_venv/bin/activate   # repo-root venv, from the bundle root
python -m modeling.scripts.build_merged_dataset | tail -25
```

Must print `verification OK` for **both** igbo and yoruba (loaders accept both roots,
dev/test identical to the original benchmark, zero leakage), and write
`merged_dataset/BUILD_REPORT.md`. Expected merged train rows: igbo 8,539 ·
yoruba 15,194. (`merged_dataset/` and `new_dataset_split/` will show as untracked in
`git status` afterwards — leave them, or commit if you want them tracked.)

Then confirm the switch reads the merged root (both languages):

```bash
MODELING_DATASET_SOURCE=merged python -c \
  "from modeling.data import load_language_bundle
for lang in ('igbo', 'yoruba'):
    b = load_language_bundle(lang); print(lang, len(b.train), len(b.dev), len(b.test))"
```

Expected output:

```text
igbo 8539 667 717
yoruba 15194 722 817
```

### 5. Server: launch the full sweep in tmux

```bash
tmux new -s retrain
# inside tmux, from the bundle root:
MODELING_DATASET_SOURCE=merged ./run_all.sh
# detach:  Ctrl+b  then  d
```

- Reattach: `tmux attach -t retrain`
- Follow the log without attaching: `tail -f logs/training_*.log`
- `run_all.sh` trains on GPU **1** by default; to use GPU 0, prefix with
  `CUDA_VISIBLE_DEVICES=0` (check `nvidia-smi` first).
- The sweep is 9 fine-tuning jobs (xlmr/afroxlmr/afriberta × igbo/yoruba + joint +
  2 cross-lingual), then the XAI explain loop, then the aggregate report — expect many
  hours on one GPU. It hard-fails early if CUDA or the venv is wrong, so check the log
  after the first few minutes.

### 6. After completion — verify and compare

```bash
tmux attach -t retrain   # or: tail -30 logs/training_*.log

# every new run records its source; expect >= 9 (the old runs have no such field):
grep -l '"dataset_source": "merged"' runs/*/*/*/metrics.json | wc -l

# aggregate report was already rebuilt by run_all.sh; safe to re-run:
python -m modeling.scripts.run_eval --aggregate-only
```

Compare merged-source runs against the previous (original-dataset) runs on the same
test split — macro F1 **and per-class F1** (see §4). To also train the other arms of
the experiment, rerun steps 4–5 with `MODELING_DATASET_SOURCE=original` or `=new`.

### 7. Publish the winners

Upload the chosen checkpoints to **new** HF repos (`*-v2-merged`) so the original
models stay live for A/B comparison — see
[../upload-model-to-huggingface.md](../upload-model-to-huggingface.md) §"Keep both
versions and A/B switch them".

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
