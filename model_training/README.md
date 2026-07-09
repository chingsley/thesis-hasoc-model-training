# KC train bundle

Self-contained copy of the thesis **modeling** stack for a provisioned server (Jupyter or CLI).

## Layout

- `modeling/` — Python package (configs under `modeling/configs/`).
- `dataset/` — `igbo_*.csv`, `yoruba_*.csv`, optional `multilingual_hate_speech_dataset.csv`.
- `runs/` — fine-tuned checkpoints and metrics (created during training).
- `reports/` — aggregate markdown report (after evaluation).
- `notebooks/` — Jupyter entry points.
- `requirements-modeling.txt` — core Python dependencies (training, baselines, eval).
- `requirements-modeling-explain.txt` — optional LIME / SHAP / Captum for `run_explain` (see macOS note below).
- `modeling/runtime_mode.py` — set `SMOKE_TEST = True` for local smoke configs (`*_smoke.yaml`); `False` for full training (restart kernel after editing).

`modeling/common.py` resolves the project root as the parent of the `modeling/` directory, so **keep this folder layout intact** after you copy `kc_train` to the server.

## Conda environment + Jupyter Notebook (recommended on a server)

Run these in order. Replace `/path/to/kc_train` with the real path to this folder on your machine.

### 1. Go to the bundle root

```bash
cd /path/to/kc_train
```

Confirm you see `modeling/`, `dataset/`, and `notebooks/`:

```bash
ls modeling dataset notebooks
```

### 2. Create and activate a Conda environment

Use a recent Python 3 (3.10–3.12 is usually fine with the pinned stack):

```bash
conda create -n kc_train python=3.11 -y
conda activate kc_train
```

If `conda activate` fails, run `conda init bash` (or `zsh`), restart the shell, then try again.

### 3. Install project dependencies (and Jupyter inside this env)

Installing Jupyter in the **same** env as `torch` / `transformers` avoids “ModuleNotFoundError” when the notebook uses the wrong kernel.

```bash
python -m pip install -U pip
python -m pip install -r requirements-modeling.txt
python -m pip install jupyter notebook ipykernel
```

Optional: register this env as a named kernel (useful if you start Jupyter from another env):

```bash
python -m ipykernel install --user --name kc_train --display-name "Python (kc_train)"
```

### 4. Start Jupyter from `kc_train`

**Important:** start the server with working directory set to **`kc_train`** (the folder that contains `modeling/` and `dataset/`), not only `notebooks/`.

```bash
cd /path/to/kc_train
conda activate kc_train
jupyter notebook --notebook-dir=/path/to/kc_train
```

Then in the browser, open `notebooks/finetune_from_config.ipynb` (single fine-tune) or `notebooks/full_modeling_pipeline.ipynb` (full sweep).

- In **Kernel → Change kernel**, choose **Python (kc_train)** if you registered it, or the interpreter that shows your `kc_train` conda env name.
- Run the first code cell before any training cell; it `chdir`s to the bundle root and fixes `sys.path`.

### 5. Check that training dependencies resolve

In a notebook cell (after the setup cell), or in the same activated shell:

```python
import torch
import transformers
from modeling.trainer import train_from_config
print(torch.__version__, transformers.__version__)
```

If that runs without error, you are ready to execute the training cells.

### Notes

- **GPU:** On a CUDA machine, `pip` usually installs a CUDA-enabled `torch` automatically. If you need a specific CUDA build, install `torch` from [pytorch.org](https://pytorch.org) first, then install the rest of `requirements-modeling.txt` (you may need to comment out or skip the `torch` line to avoid overwriting).
- **Hugging Face:** First fine-tune will download pretrained weights; ensure outbound network access.
- **Long runs:** `full_modeling_pipeline.ipynb` runs the full sweep; start with `finetune_from_config.ipynb` for a single short path to validate the setup.
- **macOS + `llvmlite` build failure:** If a full install used to pull `shap` → `numba` → `llvmlite` and failed with “Could not find LLVM”, use the split files: `pip install -r requirements-modeling.txt` (core only), then either skip explainability or run `conda install -c conda-forge llvmlite numba -y` and `pip install -r requirements-modeling-explain.txt`.
- **Transformers + Accelerate:** If you see `unwrap_model(..., keep_torch_compile)`, run `pip install -U "accelerate>=1.0,<2"` (see `requirements-modeling.txt`).
- **NumPy:** If you see `cannot import name 'ERR_IGNORE' from numpy.core.umath`, reinstall a clean NumPy: `pip uninstall numpy -y && pip install numpy`. Training uses **torch** for softmax/argmax, so NumPy 1.x or 2.x is fine when the install is not mixed/broken.

## Server setup (venv instead of conda)

```bash
cd /path/to/kc_train
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -U pip
pip install -r requirements-modeling.txt
pip install jupyter ipykernel
python -m ipykernel install --user --name kc-train --display-name "KC train"
```

Start Jupyter from **`kc_train`** (the directory that contains `modeling/` and `dataset/`) so paths resolve correctly, or rely on the path-discovery cell in the notebooks.

## CLI (same as thesis repo)

```bash
cd /path/to/kc_train
python -m modeling.scripts.run_finetune --config modeling/configs/xlmr_base.yaml --lang igbo
```

The shell script `modeling/scripts/full_modeling_pipeline.sh` matches the logic in `notebooks/full_modeling_pipeline.ipynb`.
