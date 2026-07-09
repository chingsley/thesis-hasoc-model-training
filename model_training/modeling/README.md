# Phase 2 Modeling Pipeline

This package implements the thesis Phase 2 workflow for 3-class `{Normal, Abuse, Hate}` hate-speech detection on the cleaned Igbo and Yoruba split files in `dataset/`.

## What is included

- Classical baselines: TF-IDF + Multinomial Naive Bayes, TF-IDF + LinearSVC.
- Zero-shot multilingual baselines: `bert-base-multilingual-cased`, `xlm-roberta-base`.
- Config-driven fine-tuning for `xlm-roberta-base`, `Davlan/afro-xlmr-base`, and `castorini/afriberta_large`.
- Class-imbalance handling: class-weighted loss, optional weighted sampling, optional focal loss.
- Optional augmentation hooks: NLLB back-translation for `Hate` rows and lightweight EDA on code-mixed English tokens.
- Evaluation artefacts: metrics JSON, predictions CSV, error dumps, confusion matrix PNG, robustness suite.
- Explainability outputs: LIME, SHAP, attention rollout, and Captum integrated gradients, plus proxy faithfulness/stability/sparsity metrics, per-example HTML visualizations, and an aggregate `reports/explainability_results.md`.
- Cluster templates: `modeling/slurm/*.sbatch`.

## Install

Core stack (training, baselines, eval):

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-modeling.txt
```

Explainability (`run_explain`, LIME/SHAP/Captum in `explain.py`) needs extra packages:

```bash
pip install -r requirements-modeling-explain.txt
```

On **macOS (especially Intel)**, `shap` pulls `numba` / `llvmlite`; pip may try to compile `llvmlite` and fail without LLVM. If that happens, install binaries with Conda first, then the explain requirements:

```bash
conda install -c conda-forge llvmlite numba -y
pip install -r requirements-modeling-explain.txt
```

## Smoke test vs full training

For **fast local checks** (1 epoch, small batches, no Optuna), set `SMOKE_TEST = True` in `modeling/runtime_mode.py`, or export `MODELING_SMOKE=1`. Training entry points then prefer `modeling/configs/<stem>_smoke.yaml` when it exists (e.g. `xlmr_base_smoke.yaml` alongside `xlmr_base.yaml`). Set `SMOKE_TEST = False` for full runs on GPU/cluster.

If you use the **`kc_train/`** copy of this repo, edit **`kc_train/modeling/runtime_mode.py`** (that is the package Jupyter loads when `ROOT` is `kc_train`), not only the top-level `modeling/` folder, unless you keep the two trees in sync.

CLI overrides (after changing directory to project root):

```bash
python -m modeling.scripts.run_finetune --config modeling/configs/xlmr_base.yaml --smoke --lang igbo
python -m modeling.scripts.run_finetune --config modeling/configs/xlmr_base.yaml --full --lang igbo
```

If you see `unwrap_model(..., keep_torch_compile=...)` errors, upgrade **accelerate** to 1.x: `pip install -U "accelerate>=1.0,<2"` (required by recent **transformers** with the current `requirements-modeling.txt`).

If you see **`cannot import name 'ERR_IGNORE' from numpy.core.umath`**, reinstall a clean NumPy: `pip uninstall numpy -y && pip install numpy`. Training uses **torch** for softmax/argmax, so NumPy 1.x or 2.x works when the install is consistent.

## Main commands

```bash
python -m modeling.scripts.run_baselines --lang igbo
python -m modeling.scripts.run_finetune --config modeling/configs/xlmr_base.yaml
python -m modeling.scripts.run_eval --aggregate-only
# Explain a specific checkpoint:
python -m modeling.scripts.run_explain --run runs/afro_xlmr_base/igbo/<timestamp> --lang igbo
# ...or auto-resolve the newest run for a config and explain a class-balanced sample:
python -m modeling.scripts.run_explain --latest --run-name afro_xlmr_base --lang igbo --num-rows 12
```

`run_explain` writes one `explanations/<id>.json` (LIME, SHAP, attention rollout, and Captum
integrated gradients with proxy faithfulness/sparsity/stability metrics) and an
`explanations/<id>.html` token-highlight visualization per sampled row, then rebuilds
`reports/explainability_results.md`. Useful flags: `--methods lime shap` to run a subset,
`--no-balanced` to use the first N rows, `--no-html` / `--no-report` to skip artefacts.
Optional explainability dependencies (`lime`, `shap`, `captum`) are imported lazily, so a
missing one only disables its own method instead of failing the run.

## Add more data and rerun

1. Update the split CSVs under `dataset/` or regenerate them with `python scripts/rebuild_dataset_v1_clean.py`.
2. Re-run the desired baseline or fine-tuning commands.
3. Rebuild the aggregate markdown report with `python -m modeling.scripts.run_eval --aggregate-only`.

## Notes

- All code assumes seed `42` unless overridden in YAML.
- New runs are written to fresh `runs/<model>/<language>/<timestamp>/` directories.
- Some components are optional at runtime and only activate if the related dependencies are installed.
