# Upload a trained checkpoint to Hugging Face

**When to use this:** You want a stable, versioned model URL that any machine (Mac backend, CI, teammates) can load with `from_pretrained("your/repo")`. This is the **recommended deployment path** for the thesis backend.

**Alternative:** Copy files directly with `rsync` — [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md).

## What gets uploaded

A Hugging Face **Trainer** checkpoint directory contains everything needed for inference:

```
config.json
model.safetensors   # (or pytorch_model.bin)
tokenizer.json
tokenizer_config.json
special_tokens_map.json
...
```

The script also uploads **`test_metrics.json`** (found next to the checkpoint or in its parent run folder) to the repo root. The backend's `GET /metrics` endpoint reads that file from the Hub, so metrics work on any machine without access to the server's `runs/` folder.

On the server, checkpoints live under timestamped folders:

```text
runs/<run_name>/<language>/<timestamp>/
```

Example for the **joint Igbo + Yoruba** model (good default for one backend serving both languages):

```text
runs/afro_xlmr_joint/joint_igbo_yoruba/20260514_123456/
```

## Step 1 — Find the checkpoint on the server

SSH or Remote SSH terminal:

```bash
cd ~/thesis-hasoc-model-training
ls -td runs/afro_xlmr_joint/joint_igbo_yoruba/* | head -1
```

Other trained families:

```bash
ls runs/
# afriberta_large  afro_xlmr_base  afro_xlmr_joint  xlm_roberta_base
```

Per-language runs use language subfolders, e.g. `runs/xlm_roberta_base/igbo/<timestamp>/`.

## Step 2 — Hugging Face token

1. Create account at [huggingface.co](https://huggingface.co)
2. **Settings → Access Tokens** → create a token with **write** access
3. On the server:

```bash
export HF_TOKEN=hf_xxxxxxxxxxxxxxxx
```

## Step 3 — Upload

On the server (with venv active):

```bash
cd ~/thesis-hasoc-model-training
source kc_train_venv/bin/activate
pip install huggingface-hub   # if not already installed

CHECKPOINT=$(ls -td runs/afro_xlmr_joint/joint_igbo_yoruba/* | head -1)

python backend_api_server/scripts/upload_to_hf.py \
  --checkpoint "$CHECKPOINT" \
  --repo-id yourusername/afro-xlmr-joint-igbo-yoruba-hate \
  --private
```

Use `--private` for thesis work; omit for a public model.

If `backend_api_server/` is not on the server yet, copy the script from your Mac:

```bash
scp -r /path/to/kc_train/backend_api_server/scripts/upload_to_hf.py \
  pcl:~/thesis-hasoc-model-training/upload_to_hf.py
python upload_to_hf.py --checkpoint "$CHECKPOINT" --repo-id ... --private
```

## Step 4 — Use in the backend

On your Mac, in `backend_api_server/.env`:

```env
HF_MODEL_ID=yourusername/afro-xlmr-joint-igbo-yoruba-hate
MODEL_PATH=
```

Then follow [run-backend-inference-api.md](./run-backend-inference-api.md).

First run downloads weights from Hugging Face (~1–2 GB depending on model) into the local HF cache (`~/.cache/huggingface/hub`). `/metrics` fetches `test_metrics.json` from the same repo — no `METRICS_PATH_*` needed unless you want to override with a local file.

## Hugging Face vs copying checkpoints

| | Hugging Face upload | `rsync` copy |
|--|---------------------|--------------|
| Best for | Production, sharing, reproducibility | Quick local dev, no HF account |
| Backend config | `HF_MODEL_ID=...` | `MODEL_PATH=/path/to/checkpoint` |
| Needs internet at inference | Yes (first download) | No |
| Large file transfer | Once to HF; then pull anywhere | Every machine you develop on |

## Re-upload after retraining

Upload again to the same repo (creates a new commit) or use a new repo name per experiment:

```bash
--repo-id yourusername/afro-xlmr-joint-v2
```

## Keep both versions and A/B switch them (original vs retrained)

To compare models trained on the original dataset (v1) against retrained ones (v2),
**upload v2 to new repos** — do not overwrite the v1 repos. The backend always resolves
a repo's latest `main` and cannot pin a revision today, so in-place overwrite would
make v1 unreachable from the backend.

```bash
# example: upload the merged-dataset checkpoints as v2 (on the server)
python backend_api_server/scripts/upload_to_hf.py \
  --checkpoint "$CHECKPOINT" \
  --repo-id yourusername/afro-xlmr-igbo-hate-v2-merged --private
```

`upload_to_hf.py` ships `test_metrics.json` and `predictions_test.csv` with each
checkpoint, so the `/metrics` and `/posts` endpoints automatically follow whichever
version is active.

Then keep both blocks in `backend_api_server/.env` and toggle by commenting (restart
the backend after each edit):

```env
# v1 — trained on the original dataset
# HF_MODEL_ID_IGBO=yourusername/afro-xlmr-igbo-hate
# HF_MODEL_ID_YORUBA=yourusername/afro-xlmr-yoruba-hate
# HF_MODEL_ID_JOINT=yourusername/afro-xlmr-joint-igbo-yoruba-hate

# v2 — retrained on the merged dataset
HF_MODEL_ID_IGBO=yourusername/afro-xlmr-igbo-hate-v2-merged
HF_MODEL_ID_YORUBA=yourusername/afro-xlmr-yoruba-hate-v2-merged
HF_MODEL_ID_JOINT=yourusername/afro-xlmr-joint-igbo-yoruba-hate-v2-merged
```

Notes:

- Both versions stay side-by-side in the local HF cache
  (`~/.cache/huggingface/hub/models--<org>--<repo>/`), so switching back to v1 later
  is instant — no re-download.
- Because v2 was trained with `MODELING_DATASET_SOURCE=merged` on the **same test
  split**, the `/metrics` numbers of v1 and v2 are directly comparable. Save a copy of
  v1's `test_metrics.json` (or screenshot the dashboard) before switching, so you can
  compare side-by-side — only one version is active at a time.
- Optional insurance before any re-upload: tag the current v1 revision on the Hub
  (`huggingface_hub.create_tag(repo_id, tag="v1-original")` or the repo's web UI), so
  the exact v1 weights stay addressable forever.

## Related

- Copy instead of upload: [copy-checkpoints-between-machines.md](./copy-checkpoints-between-machines.md)
- Run API: [run-backend-inference-api.md](./run-backend-inference-api.md)
